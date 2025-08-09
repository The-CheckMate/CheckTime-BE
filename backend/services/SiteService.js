// 사이트 관리를 위하여...
const { Pool } = require('pg');
const levenshtein = require('fast-levenshtein');
const SiteDiscoveryService = require('./SiteDiscoveryService');
const { URL } = require('url');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

class SiteService {
  constructor() {
    this.similarityThreshold = 0.6; // 유사도 임계값
    this.maxSearchResults = 1; // 최대 검색 결과 수
    this.discovery = new SiteDiscoveryService(); // 자동 발견 로직 수행
    this.autoDiscoveryThreshold = 0.9; // 자동 발견을 위한 최소 유사도 임계값
  }

  /**
   * 모든 사이트 조회
   */
  async getAllSites(page = 1, limit = 20, category = null, sortBy = 'usage_count') {
    try {
      let query = `
        SELECT 
          id, url, name, category, description, optimal_offset,
          keywords, usage_count, average_rtt, success_rate,
          created_at, updated_at
        FROM sites 
        WHERE is_active = true
      `;
      
      const params = [];
      let paramIndex = 1;
      
      if (category) {
        query += ` AND category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }
      
      // 정렬
      const validSortColumns = ['usage_count', 'success_rate', 'average_rtt', 'name', 'created_at'];
      const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'usage_count';
      
      if (sortColumn === 'usage_count' || sortColumn === 'success_rate') {
        query += ` ORDER BY ${sortColumn} DESC`;
      } else {
        query += ` ORDER BY ${sortColumn} ASC`;
      }
      
      // 페이징
      const offset = (page - 1) * limit;
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);
      
      const result = await pool.query(query, params);
      
      // 전체 개수 조회
      let countQuery = 'SELECT COUNT(*) FROM sites WHERE is_active = true';
      const countParams = [];
      
      if (category) {
        countQuery += ' AND category = $1';
        countParams.push(category);
      }
      
      const countResult = await pool.query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].count);
      
      return {
        sites: result.rows,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNext: page < Math.ceil(totalCount / limit),
          hasPrev: page > 1
        }
      };
      
    } catch (error) {
      console.error('사이트 목록 조회 실패:', error);
      throw new Error('사이트 목록을 불러올 수 없습니다');
    }
  }

  /**
   * 사이트 검색 (유사도 기반 + 자동 발견)
   */
  async searchSites(searchTerm, autoDiscover=true) {
    try {
      console.log(`사이트 검색: "${searchTerm}"`);
      
      // 1. 데이터베이스에서 모든 활성 사이트 조회
      const allSitesResult = await pool.query(`
        SELECT id, url, name, category, keywords, usage_count, success_rate, average_rtt
        FROM sites 
        WHERE is_active = true
      `);
      
      // 2. 한글 도메인 매핑 확인
      const koreanMappingResult = await this.findKoreanDomainMapping(searchTerm);
      
      // 3. 유사도 계산 및 검색 결과 생성
      const searchResults = [];
      let bestSimilarity = 0;
      let bestMatch = null; // 최고 유사도 매치 추적
      
      for (const site of allSitesResult.rows) {
        const similarity = this.calculateSiteSimilarity(searchTerm, site);
        
        // 최고 유사도 추적
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = site;
        }

        if (similarity >= this.similarityThreshold) {
          searchResults.push({
            ...site,
            similarity: parseFloat(similarity.toFixed(3)),
            matchReason: this.getMatchReason(searchTerm, site, similarity)
          });
        }
        bestSimilarity= Math.max(bestSimilarity, similarity);
      }
      
      // 4. 한글 도메인 매핑 결과 추가
      if (koreanMappingResult) {
        // 중복 제거 후 추가
        const existingUrls = searchResults.map(s => s.url);
        if (!existingUrls.includes(koreanMappingResult.actual_url)) {
          const mappedSite = await this.getSiteByUrl(koreanMappingResult.actual_url);
          if (mappedSite) {
            searchResults.unshift({
              ...mappedSite,
              similarity: 1.0,
              matchReason: 'korean_domain_mapping'
            });
            bestSimilarity = 1.0;
          }
        }
      }
      
      // 5. 정확한 URL 매치 확인
      if (this.isValidUrl(searchTerm)) {
        const exactMatch = await this.getSiteByUrl(searchTerm);
        if (exactMatch) {
          const existingIndex = searchResults.findIndex(s => s.url === searchTerm);
          if (existingIndex >= 0) {
            searchResults[existingIndex].similarity = 1.0;
            searchResults[existingIndex].matchReason = 'exact_url_match';
          } else {
            searchResults.unshift({
              ...exactMatch,
              similarity: 1.0,
              matchReason: 'exact_url_match'
            });
            bestSimilarity = 1.0;
          }
        }
      }

      // 6. 자동 발견 로직 (기존 검색 결과가 없거나 유사도가 낮을 때)
      let discoveredSite = null;
      if(autoDiscover && bestSimilarity < this.autoDiscoveryThreshold){
        console.log(`자동 발견 시작: 최고 유사도 ${bestSimilarity} < ${this.autoDiscoveryThreshold}`);

        try{
          const discoveryResult = await this.discovery.discoverSiteUrl(searchTerm);

          if (discoveryResult && discoveryResult.url) {
            console.log(`자동 발견 성공: ${discoveryResult.url}`);
            
            // 발견된 URL이 이미 DB에 있는지 확인
            const existingSite = await this.getSiteByUrl(discoveryResult.url);
            
            if (existingSite) {
              // 이미 존재하는 사이트면 검색 결과에 추가
              console.log('발견된 URL이 이미 DB에 존재함');
              searchResults.unshift({
                ...existingSite,
                similarity: 0.9,
                matchReason: 'auto_discovered_existing'
              });
            } else {
              // 새로운 사이트면 DB에 자동 등록
              console.log('새로운 사이트 자동 등록 중...');
              discoveredSite = await this.autoRegisterDiscoveredSite(discoveryResult, searchTerm);
              
              if (discoveredSite) {
                searchResults.unshift({
                  ...discoveredSite,
                  similarity: 0.95,
                  matchReason: 'auto_discovered_new',
                  isNewlyRegistered: true
                });
                console.log(`새로운 사이트 자동 등록 완료: ${discoveredSite.name}`);
              }
            }
          }
        } catch (discoveryError) {
          console.warn('자동 발견 실패:', discoveryError.message);
          // 자동 발견 실패는 전체 검색을 중단하지 않음
        }
      }

      // 자동 발견 실패 시 최고 유사도 결과라도 포함
      if (searchResults.length === 0 && bestMatch) {
        console.log('검색 결과가 없어서 최고 유사도 결과 포함');
        searchResults.push({
          ...bestMatch,
          similarity: parseFloat(bestSimilarity.toFixed(3)),
          matchReason: this.getMatchReason(searchTerm, bestMatch, bestSimilarity) + '_fallback'
        });
      }
      
      // 7. 결과 정렬 및 제한
      const sortedResults = searchResults
        .sort((a, b) => {
          // 새로 발견된 것 최우선
          if (a.isNewlyRegistered && !b.isNewlyRegistered) return -1;
          if (!a.isNewlyRegistered && b.isNewlyRegistered) return 1;

          // 정확한 매치 우선
          if (a.similarity !== b.similarity) {
            return b.similarity - a.similarity;
          }
          // 사용 빈도 순
          return b.usage_count - a.usage_count;
        })
        .slice(0, this.maxSearchResults);
      
      
      console.log(`검색 완료: ${sortedResults.length}개 결과 찾음`);
      
      return {
        searchTerm,
        results: sortedResults,
        totalFound: sortedResults.length,
        koreanMapping: koreanMappingResult,
        autoDiscovery: discoveredSite ? {
          discovered: true,
          newSite: discoveredSite,
          source: discoveredSite.discovery_source
        } : { 
          discovered: false,
          attempted : bestSimilarity<this.autoDiscoveryThreshold},
        bestSimilarityFromDb: bestSimilarity,
        searchedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('사이트 검색 실패:', error);
      throw new Error('사이트 검색 중 오류가 발생했습니다');
    }
  }

  /**
   * 사이트 유사도 계산
   */
  calculateSiteSimilarity(searchTerm, site) {
    const term = searchTerm.toLowerCase().trim();
    let maxSimilarity = 0;
    
    // 1. 사이트 이름과의 유사도
    const nameNormalized = this.normalizeKoreanText(site.name);
    const nameSimilarity = this.calculateStringSimilarity(term, nameNormalized);
    maxSimilarity = Math.max(maxSimilarity, nameSimilarity);
    
    // 2. URL과의 유사도
    if (site.url) {
      const urlParts = this.extractUrlParts(site.url);
      for (const part of urlParts) {
        const urlSimilarity = this.calculateStringSimilarity(term, part) * 0.9 ; // url 유사도 10% 줄이기
        maxSimilarity = Math.max(maxSimilarity, urlSimilarity);
      }
    }
    
    // 3. 키워드와의 유사도
    if (site.keywords && Array.isArray(site.keywords)) {
      for (const keyword of site.keywords) {
        const keywordNormalized = this.normalizeKoreanText(keyword);
        const keywordSimilarity = this.calculateStringSimilarity(term, keywordNormalized);
        maxSimilarity = Math.max(maxSimilarity, keywordSimilarity);
        
        // 완전 일치 보너스
        if (keywordNormalized === term) {
          maxSimilarity = 1.0;
          break;
        }
      }
    }
    
    // 4. 부분 문자열 매치 보너스
    const nameContains = nameNormalized.includes(term) || term.includes(nameNormalized);
    if (nameContains && term.length >= 3) {
      maxSimilarity = Math.max(maxSimilarity, 0.7);
    }
    
    return maxSimilarity;
  }

  /**
   * 문자열 유사도 계산 (Levenshtein + 정규화)
   */
  calculateStringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1.0;
    
    const maxLength = Math.max(s1.length, s2.length);
    if (maxLength === 0) return 1.0;
    
    const distance = levenshtein.get(s1, s2);
    return 1 - (distance / maxLength);
  }

  /**
   * 한글 텍스트 정규화
   */
  normalizeKoreanText(text) {
    if (!text) return '';
    
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '') // 공백 제거
      .replace(/[^\w가-힣]/g, ''); // 특수문자 제거, 한글과 영숫자만 유지
  }

  /**
   * URL 파트 추출
   */
  extractUrlParts(url) {
    try {
      const parsedUrl = new URL(url);
      const parts = [];
      
      // 도메인 파트
      const hostname = parsedUrl.hostname.replace('www.', '');
      parts.push(hostname);
      
      // 도메인을 점으로 분리
      const domainParts = hostname.split('.');
      parts.push(...domainParts);
      
      // 경로 파트
      if (parsedUrl.pathname && parsedUrl.pathname !== '/') {
        const pathParts = parsedUrl.pathname.split('/').filter(p => p.length > 0);
        parts.push(...pathParts);
      }
      
      return parts.map(part => part.toLowerCase());
      
    } catch (error) {
      return [url.toLowerCase()];
    }
  }

  /**
   * 매치 이유 반환
   */
  getMatchReason(searchTerm, site, similarity) {
    const term = searchTerm.toLowerCase();
    const siteName = site.name.toLowerCase();
    
    if (similarity === 1.0) {
      if (siteName === term) return 'exact_name_match';
      if (site.keywords && site.keywords.some(k => k.toLowerCase() === term)) {
        return 'exact_keyword_match';
      }
      return 'perfect_match';
    }
    
    if (similarity >= 0.9) return 'high_similarity';
    if (similarity >= 0.8) return 'good_similarity';
    if (siteName.includes(term) || term.includes(siteName)) return 'partial_match';
    
    return 'keyword_similarity';
  }

  /**
   * 한글 도메인 매핑 찾기
   */
  async findKoreanDomainMapping(searchTerm) {
    try {
      const result = await pool.query(`
        SELECT korean_name, actual_url, similarity_threshold
        FROM domain_mappings
        WHERE LOWER(korean_name) = LOWER($1)
           OR korean_name ILIKE $2
        ORDER BY 
          CASE WHEN LOWER(korean_name) = LOWER($1) THEN 1 ELSE 2 END,
          LENGTH(korean_name) ASC
        LIMIT 1
      `, [searchTerm, `%${searchTerm}%`]);
      
      if (result.rows.length > 0) {
        const mapping = result.rows[0];
        const similarity = this.calculateStringSimilarity(searchTerm, mapping.korean_name);
        
        if (similarity >= mapping.similarity_threshold) {
          return mapping;
        }
      }
      
      return null;
      
    } catch (error) {
      console.error('한글 도메인 매핑 검색 실패:', error);
      return null;
    }
  }

  /**
   * URL로 사이트 조회
   */
  async getSiteByUrl(url) {
    try {
      const result = await pool.query(
        'SELECT * FROM sites WHERE url = $1 AND is_active = true',
        [url]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
      
    } catch (error) {
      console.error('URL로 사이트 조회 실패:', error);
      return null;
    }
  }

  /**
   * 새 사이트 추가
   */
  async addSite(siteData, createdBy = null) {
    try {
      // URL 유효성 검증
      if (!this.isValidUrl(siteData.url)) {
        throw new Error('유효하지 않은 URL입니다');
      }
      
      // 중복 검사
      const existingSite = await this.getSiteByUrl(siteData.url);
      if (existingSite) {
        throw new Error('이미 등록된 사이트입니다');
      }
      
      const {
        url,
        name,
        category = 'general',
        description = null,
        optimal_offset = 2500,
        keywords = []
      } = siteData;
      
      const result = await pool.query(`
        INSERT INTO sites (url, name, category, description, optimal_offset, keywords, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [url, name, category, description, optimal_offset, keywords, createdBy]);
      
      console.log(`새 사이트 추가됨: ${name} (${url})`);
      
      return result.rows[0];
      
    } catch (error) {
      console.error('사이트 추가 실패:', error);
      throw error;
    }
  }

  /**
   * 사이트 업데이트
   */
  async updateSite(siteId, updateData, userId = null) {
    try {
      const existingSite = await pool.query(
        'SELECT * FROM sites WHERE id = $1 AND is_active = true',
        [siteId]
      );
      
      if (existingSite.rows.length === 0) {
        throw new Error('사이트를 찾을 수 없습니다');
      }
      
      const allowedFields = [
        'name', 'category', 'description', 'optimal_offset', 'keywords'
      ];
      
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;
      
      for (const [field, value] of Object.entries(updateData)) {
        if (allowedFields.includes(field) && value !== undefined) {
          updateFields.push(`${field} = $${paramIndex}`);
          updateValues.push(value);
          paramIndex++;
        }
      }
      
      if (updateFields.length === 0) {
        throw new Error('업데이트할 필드가 없습니다');
      }
      
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      updateValues.push(siteId);
      
      const query = `
        UPDATE sites 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;
      
      const result = await pool.query(query, updateValues);
      
      console.log(`사이트 업데이트됨: ID ${siteId}`);
      
      return result.rows[0];
      
    } catch (error) {
      console.error('사이트 업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 사이트 삭제 (소프트 삭제)
   */
  async deleteSite(siteId, userId = null) {
    try {
      const result = await pool.query(`
        UPDATE sites 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND is_active = true
        RETURNING *
      `, [siteId]);
      
      if (result.rows.length === 0) {
        throw new Error('사이트를 찾을 수 없습니다');
      }
      
      console.log(`사이트 삭제됨: ID ${siteId}`);
      
      return { success: true, message: '사이트가 삭제되었습니다' };
      
    } catch (error) {
      console.error('사이트 삭제 실패:', error);
      throw error;
    }
  }

  /**
   * 인기 사이트 조회
   */
  async getPopularSites(limit = 10, category = null) {
    try {
      let query = `
        SELECT id, url, name, category, usage_count, success_rate, average_rtt
        FROM sites 
        WHERE is_active = true
      `;
      
      const params = [];
      
      if (category) {
        query += ' AND category = $1';
        params.push(category);
      }
      
      query += ' ORDER BY usage_count DESC, success_rate DESC LIMIT $' + (params.length + 1);
      params.push(limit);
      
      const result = await pool.query(query, params);
      
      return result.rows;
      
    } catch (error) {
      console.error('인기 사이트 조회 실패:', error);
      throw new Error('인기 사이트를 불러올 수 없습니다');
    }
  }

  /**
   * 카테고리 목록 조회
   */
  async getCategories() {
    try {
      const result = await pool.query(`
        SELECT 
          category,
          COUNT(*) as site_count,
          AVG(success_rate) as avg_success_rate
        FROM sites 
        WHERE is_active = true 
        GROUP BY category 
        ORDER BY site_count DESC
      `);
      
      return result.rows;
      
    } catch (error) {
      console.error('카테고리 목록 조회 실패:', error);
      throw new Error('카테고리 목록을 불러올 수 없습니다');
    }
  }

  /**
   * URL 유효성 검증
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 사이트 사용량 증가
   */
  async incrementUsage(siteId) {
    try {
      await pool.query(`
        UPDATE sites 
        SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [siteId]);
    } catch (error) {
      console.error('사이트 사용량 증가 실패:', error);
    }
  }

  /**
   * URL 자동 보정 제안
   */
  async suggestUrlCorrection(inputUrl) {
    try {
      // 일반적인 URL 오타 패턴 보정
      let correctedUrl = inputUrl.toLowerCase().trim();
      
      // 프로토콜 자동 추가
      if (!correctedUrl.startsWith('http://') && !correctedUrl.startsWith('https://')) {
        correctedUrl = 'https://' + correctedUrl;
      }
      
      // 일반적인 오타 패턴 보정
      const commonCorrections = {
        'htps://': 'https://',
        'http;//': 'https://',
        'wwww.': 'www.',
        '.co.kr': '.co.kr',
        '.coom': '.com',
        '.comm': '.com',
        'goole': 'google',
        'naver.co': 'naver.com'
      };
      
      for (const [wrong, correct] of Object.entries(commonCorrections)) {
        correctedUrl = correctedUrl.replace(wrong, correct);
      }
      
      // 데이터베이스에서 유사한 URL 찾기
      const allSites = await pool.query(`
        SELECT url, name FROM sites WHERE is_active = true
      `);
      
      const suggestions = [];
      
      for (const site of allSites.rows) {
        const similarity = this.calculateStringSimilarity(correctedUrl, site.url);
        if (similarity >= 0.7) {
          suggestions.push({
            originalUrl: site.url,
            siteName: site.name,
            similarity: parseFloat(similarity.toFixed(3))
          });
        }
      }
      
      // 유사도 순으로 정렬
      suggestions.sort((a, b) => b.similarity - a.similarity);
      
      return {
        inputUrl,
        correctedUrl: correctedUrl !== inputUrl.toLowerCase().trim() ? correctedUrl : null,
        suggestions: suggestions.slice(0, 5),
        hasSuggestions: suggestions.length > 0
      };
      
    } catch (error) {
      console.error('URL 자동 보정 실패:', error);
      return {
        inputUrl,
        correctedUrl: null,
        suggestions: [],
        hasSuggestions: false,
        error: error.message
      };
    }
  }

  /**
   * 사이트 성능 분석
   */
  async analyzeSitePerformance(siteId, days = 30) {
    try {
      const result = await pool.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total_attempts,
          SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_attempts,
          AVG(rtt) as avg_rtt,
          AVG(optimal_offset) as avg_offset
        FROM access_logs 
        WHERE site_id = $1 
          AND created_at > CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, [siteId]);
      
      const dailyStats = result.rows.map(row => ({
        date: row.date,
        totalAttempts: parseInt(row.total_attempts),
        successfulAttempts: parseInt(row.successful_attempts),
        successRate: (parseInt(row.successful_attempts) / parseInt(row.total_attempts)) * 100,
        avgRTT: parseFloat(row.avg_rtt) || 0,
        avgOffset: parseFloat(row.avg_offset) || 0
      }));
      
      // 전체 통계
      const overallStats = await pool.query(`
        SELECT 
          COUNT(*) as total_attempts,
          SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_attempts,
          AVG(rtt) as avg_rtt,
          MIN(rtt) as min_rtt,
          MAX(rtt) as max_rtt,
          AVG(optimal_offset) as avg_offset
        FROM access_logs 
        WHERE site_id = $1 
          AND created_at > CURRENT_DATE - INTERVAL '${days} days'
      `, [siteId]);
      
      const overall = overallStats.rows[0];
      
      return {
        siteId,
        period: `${days} days`,
        dailyStats,
        overall: {
          totalAttempts: parseInt(overall.total_attempts) || 0,
          successfulAttempts: parseInt(overall.successful_attempts) || 0,
          successRate: overall.total_attempts > 0 
            ? (parseInt(overall.successful_attempts) / parseInt(overall.total_attempts)) * 100 
            : 0,
          avgRTT: parseFloat(overall.avg_rtt) || 0,
          minRTT: parseFloat(overall.min_rtt) || 0,
          maxRTT: parseFloat(overall.max_rtt) || 0,
          avgOffset: parseFloat(overall.avg_offset) || 0
        },
        analyzedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('사이트 성능 분석 실패:', error);
      throw new Error('사이트 성능 분석을 수행할 수 없습니다');
    }
  }

  /**
   * 배치 사이트 추가 (CSV 등에서 대량 추가)
   */
  async bulkAddSites(sitesData, createdBy = null) {
    const results = [];
    const errors = [];
    
    for (let i = 0; i < sitesData.length; i++) {
      try {
        const site = await this.addSite(sitesData[i], createdBy);
        results.push({ index: i, success: true, site });
      } catch (error) {
        errors.push({ 
          index: i, 
          success: false, 
          error: error.message,
          data: sitesData[i]
        });
      }
    }
    
    return {
      totalProcessed: sitesData.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors
    };
  }

  /**
   * 자동 발견된 사이트를 DB에 등록
   */
  async autoRegisterDiscoveredSite(discoveryResult, originalSearchTerm) {
    try {
      const siteData = {
        url: discoveryResult.url,
        name: discoveryResult.name || originalSearchTerm,
        category: discoveryResult.category || 'general',
        description: discoveryResult.description || `자동 발견된 사이트: ${originalSearchTerm}`,
        optimal_offset: 2500,
        keywords: [
          originalSearchTerm,
          ...(discoveryResult.keywords || [])
        ].filter((k, i, arr) => arr.indexOf(k) === i) // 중복 제거
      };
      
      const result = await pool.query(`
        INSERT INTO sites (
          url, name, category, description, optimal_offset, keywords, auto_discovered,
          discovery_source, discovery_confidence, last_verified_at, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, now(), $9)
        RETURNING *
      `, [
        siteData.url,
        siteData.name,
        siteData.category,
        siteData.description,
        siteData.optimal_offset,
        siteData.keywords,
        discoveryResult.source, // discovery_source
        discoveryResult.confidence, // discovery_confidence
        null // created_by: 자동 발견은 사용자 정보가 없으므로 null
      ]);
      
      // 자동 등록 로그 기록
      await this.logAutoDiscovery(originalSearchTerm, discoveryResult, result.rows[0].id);
      
      return result.rows[0];
      
    } catch (error) {
      console.error('자동 발견 사이트 등록 실패:', error);
      
      // 중복 URL 오류인 경우 기존 사이트 반환
      if (error.message.includes('이미 등록된 사이트')) {
        return await this.getSiteByUrl(discoveryResult.url);
      }
      
      throw error;
    }
  }

  /**
   * 자동 발견 로그 기록
   */
  async logAutoDiscovery(searchTerm, discoveryResult, siteId) {
    try {
      await pool.query(`
        INSERT INTO site_discovery_logs (
          search_term, discovered_url, site_id, created_at
        )
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      `, [
        searchTerm,
        discoveryResult.url,
        siteId
      ]);
    } catch (error) {
      console.warn('자동 발견 로그 기록 실패:', error.message);
      // 로그 실패는 전체 프로세스를 중단하지 않음
    }
  }

}

module.exports = SiteService;