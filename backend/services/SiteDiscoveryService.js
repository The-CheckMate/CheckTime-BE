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
    // 1) 만약 검색어가 유효한 URL이면 바로 URL 정보 반환
    const directUrlResult = await this.checkIfValidUrlAndReturn(searchTerm);
    if (directUrlResult) {
      return directUrlResult;
    }

    // 2) 검색어 정규화 | 검색어가 URL 형태면 protocol 과 trailing slash 제거
    const normalizedTerm = searchTerm
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');

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
          strategy(normalizedTerm),
          new Promise((_, rj) => setTimeout(() => rj(new Error('Timeout')), this.timeout))
        ]);
        if (result?.url) return result;
      } catch { /* 다음 전략 */ }
    }
    return null;
  }

async searchUniversityAPI(term) {
  const res = await axios.get('http://universities.hipolabs.com/search', {
    params: { name: term, country: 'Korea, Republic of' },
    timeout: 5000
  });
  if (!Array.isArray(res.data) || res.data.length === 0) return null;
  
  //---------------------
  // 로그 찍기
//    console.log('[searchUniversityAPI] API 결과 개수:', res.data.length);
  // 결과 간단히 출력 (이름만)
//  res.data.forEach((item, index) => {
//    console.log(`[searchUniversityAPI] ${index + 1}: ${item.name}, domains: ${JSON.stringify(item.domains)}`);
//  });
  //---------------------

  for (const match of res.data) {
    if (!Array.isArray(match.web_pages) || match.web_pages.length === 0) {
      continue; // web_pages가 없으면 다음 후보로
    }

    const url = match.web_pages[0];
    if (!url) continue;

    // URL 유효성 검사 (헤드 요청 등)
    const isValid = await this.validateUrl(url);
    if (isValid) {
      // 유효한 URL 찾으면 메타 수집 후 바로 반환
      const meta = await this.getMeta(url);
      return {
        url,
        name: meta.title || match.name,
        description: meta.description,
        category: '교육기관',
        keywords: [term],
        confidence: 0.95,
        source: 'university-api'
      };
    }
  }
  
  // 유효한 URL이 하나도 없으면 null 반환
  //console.log('[searchUniversityAPI] 유효한 URL을 찾지 못함');
  return null;
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
    //console.log('[searchKoreanPattern] 유효한 URL을 찾지 못함');

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
          // 20자 내로 자르기 (글자수가 20자 초과일 때만 잘라냄)
        const truncate = (str, maxLength) => str && str.length > maxLength ? str.slice(0, maxLength) : str;
          return { url:r.url, name:truncate(meta.title || r.title, 20), description:truncate(meta.description, 20), category:'기타', keywords:[term], confidence:0.75, source:'web-scraping' };
        }
      }
    } finally { await browser.close(); }
    
    //console.log('[searchWebScarping] 유효한 URL을 찾지 못함');
    return null;
  }

  // 4. 일반 도메인 패턴
  async searchCommonDomains(term) {
    const n = term.replace(/\s+/g,'').toLowerCase();
    const patterns = [`${n}.ac.kr`,`www.${n}.ac.kr`,`${n}.co.kr`,`www.${n}.co.kr`,`${n}.com`,`www.${n}.com`,`${n}.org`];
    
    // 20자 내로 자르는 헬퍼 함수
    const truncate = (str, maxLength = 20) => {
        if (!str) return '';
        return str.length > maxLength ? str.slice(0, maxLength) : str;
    };

    for(const d of patterns){
      const url = `https://${d}`;
      if (await this.validateUrl(url)) {
        const meta = await this.getMeta(url);
        return { url, name:truncate(meta.title || term, 20), description:truncate(meta.description, 20), category:'기업', keywords:[term], confidence:0.65, source:'common-domain' };
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

  /**
   * 입력이 유효한 URL이라면 해당 URL 정보를 바로 반환
   */
  async checkIfValidUrlAndReturn(url) {
    // URL 문법 검사
    try {
      new URL(url);
    } catch {
      return null;
    }

    // URL이 실제 접근 가능한지 검사 (HEAD 요청)
    const isValid = await this.validateUrl(url);
    if (!isValid) return null;

    // 메타 정보 불러오기
    const meta = await this.getMeta(url);

    return {
      url,
      name: meta.title || url,
      description: meta.description || '',
      category: '기타',
      keywords: [url],
      confidence: 1.0,
      source: 'direct-url'
    };
  }

}

module.exports = SiteDiscoveryService;