const axios = require('axios');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { URL } = require('url');

class SiteDiscoveryService {
    constructor() {
    this.timeout = 10000;
    this.userAgent = 'Mozilla/5.0 ...';
  }

  // 메인 메서드
  async discoverSiteUrl(searchTerm) {
    // 전략 목록
    const strategies = [
      this.searchUniversityAPI.bind(this),
      this.searchKoreanPattern.bind(this),
      this.searchWebScraping.bind(this),
      this.searchCommonDomains.bind(this)
    ];

    for (const strategy of strategies) {
      try {
        const result = await Promise.race([
          strategy(searchTerm),
          new Promise((_, rj) => setTimeout(() => rj(new Error('Timeout')), this.timeout))
        ]);
        if (result?.url) return result;
      } catch { /* 다음 전략 */ }
    }
    return null;
  }

  // 1. 대학교 API (hipolabs)
  async searchUniversityAPI(term) {
    if (!/대학|대학교/.test(term)) return null;
    const res = await axios.get('http://universities.hipolabs.com/search', { params:{name:term,country:'South Korea'}, timeout:5000 });
    if (!res.data.length) return null;
    const uni = res.data[0], url = uni.web_pages;
    if (!(await this.validateUrl(url))) return null;
    const meta = await this.getMeta(url);
    return { url, name:meta.title||uni.name, description:meta.description, category:'교육기관', keywords:[term], confidence:0.95, source:'university-api' };
  }

  // 2. 한글 도메인 패턴
  async searchKoreanPattern(term) {
    const normalized = term.replace(/\s+/g,'').toLowerCase();
    const patterns = [`${normalized}.ac.kr`,`${normalized}.go.kr`,`${normalized}.co.kr`];
    for (const d of patterns) {
      const url = `https://${d}`;
      if (await this.validateUrl(url)) {
        const meta = await this.getMeta(url);
        return { url, name:meta.title||term, description:meta.description, category:'정부/교육', keywords:[term], confidence:0.88, source:'korean-pattern' };
      }
    }
    return null;
  }

  // 3. 웹 스크래핑(네이버)
  async searchWebScraping(term) {
    const browser = await puppeteer.launch({ headless:true, args:['--no-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setUserAgent(this.userAgent);
      await page.goto(`https://search.naver.com/search.naver?query=${encodeURIComponent(term+' 공식홈페이지')}`,{waitUntil:'networkidle2',timeout:8000});
      const results = await page.$$eval('.link_tit, .total_tit', els => els.slice(0,3).map(e=>({url:e.href,title:e.textContent.trim()})));
      for (const r of results) {
        if (await this.validateUrl(r.url)) {
          const meta = await this.getMeta(r.url);
          return { url:r.url, name:meta.title||r.title, description:meta.description, category:'기타', keywords:[term], confidence:0.75, source:'web-scraping' };
        }
      }
    } finally { await browser.close(); }
    return null;
  }

  // 4. 일반 도메인 패턴
  async searchCommonDomains(term) {
    const n = term.replace(/\s+/g,'').toLowerCase();
    for (const d of [`${n}.com`,`www.${n}.com`,`${n}.org`]) {
      const url = `https://${d}`;
      if (await this.validateUrl(url)) {
        const meta = await this.getMeta(url);
        return { url, name:meta.title||term, description:meta.description, category:'기업', keywords:[term], confidence:0.65, source:'common-domain' };
      }
    }
    return null;
  }

  async validateUrl(url) {
    try { const res = await axios.head(url,{timeout:3000,validateStatus:s=>s<400}); return res.status<400; }
    catch { return false; }
  }

  async getMeta(url) {
    try {
      const res = await axios.get(url,{timeout:5000,headers:{'User-Agent':this.userAgent}});
      const $ = cheerio.load(res.data);
      return { title:$('title').text().trim(), description:$('meta[name="description"]').attr('content')||'' };
    } catch { return {title:'',description:''}; }
  }
}

module.exports = SiteDiscoveryService;
