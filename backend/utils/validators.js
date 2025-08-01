const url = require('url');

/**
 * URL 유효성 검증
 */
function isValidUrl(urlString) {
  try {
    const parsedUrl = new URL(urlString);
    
    // 허용된 프로토콜
    const allowedProtocols = ['http:', 'https:'];
    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      return false;
    }
    
    // 호스트명 검증
    if (!parsedUrl.hostname || parsedUrl.hostname.length < 3) {
      return false;
    }
    
    // 로컬호스트 및 사설 IP 차단 (프로덕션에서)
    if (process.env.NODE_ENV === 'production') {
      const hostname = parsedUrl.hostname.toLowerCase();
      const blockedHostnames = ['localhost', '127.0.0.1', '0.0.0.0'];
      const privateIpRegex = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|169\.254\.)/;
      
      if (blockedHostnames.includes(hostname) || privateIpRegex.test(hostname)) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 이메일 유효성 검증
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  // 기본 형식 검증
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return false;
  }
  
  // 길이 검증
  if (email.length > 254) {
    return false;
  }
  
  // 도메인 부분 검증
  const [, domain] = email.split('@');
  if (domain.length > 253) {
    return false;
  }
  
  return true;
}

/**
 * 비밀번호 강도 검증
 */
function validatePasswordStrength(password) {
  const result = {
    valid: false,
    score: 0,
    requirements: {
      length: false,
      lowercase: false,
      uppercase: false,
      numbers: false,
      symbols: false
    },
    feedback: []
  };
  
  if (!password || typeof password !== 'string') {
    result.feedback.push('비밀번호를 입력해주세요');
    return result;
  }
  
  // 길이 검증 (최소 8자)
  if (password.length >= 8) {
    result.requirements.length = true;
    result.score += 1;
  } else {
    result.feedback.push('비밀번호는 최소 8자 이상이어야 합니다');
  }
  
  // 소문자 검증
  if (/[a-z]/.test(password)) {
    result.requirements.lowercase = true;
    result.score += 1;
  } else {
    result.feedback.push('소문자를 포함해야 합니다');
  }
  
  // 대문자 검증
  if (/[A-Z]/.test(password)) {
    result.requirements.uppercase = true;
    result.score += 1;
  } else {
    result.feedback.push('대문자를 포함해야 합니다');
  }
  
  // 숫자 검증
  if (/\d/.test(password)) {
    result.requirements.numbers = true;
    result.score += 1;
  } else {
    result.feedback.push('숫자를 포함해야 합니다');
  }
  
  // 특수문자 검증
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    result.requirements.symbols = true;
    result.score += 1;
  } else {
    result.feedback.push('특수문자를 포함해야 합니다');
  }
  
  // 연속된 문자 검증
  if (/(.)\1{2,}/.test(password)) {
    result.feedback.push('연속된 동일한 문자는 3개 이상 사용할 수 없습니다');
    result.score -= 1;
  }
  
  // 최종 점수 계산
  result.score = Math.max(0, result.score);
  result.valid = result.score >= 4;
  
  return result;
}

/**
 * 사용자명 유효성 검증
 */
function isValidUsername(username) {
  if (!username || typeof username !== 'string') {
    return false;
  }
  
  // 길이 검증 (2-30자)
  if (username.length < 2 || username.length > 30) {
    return false;
  }
  
  // 허용된 문자만 사용 (영문, 숫자, 언더스코어, 하이픈)
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(username)) {
    return false;
  }
  
  // 숫자로만 구성된 경우 금지
  if (/^\d+$/.test(username)) {
    return false;
  }
  
  // 예약어 검증
  const reservedWords = ['admin', 'root', 'user', 'test', 'guest', 'api', 'www', 'mail', 'support'];
  if (reservedWords.includes(username.toLowerCase())) {
    return false;
  }
  
  return true;
}

/**
 * 사이트 이름 유효성 검증
 */
function isValidSiteName(name) {
  if (!name || typeof name !== 'string') {
    return false;
  }
  
  // 길이 검증 (2-100자)
  if (name.length < 2 || name.length > 100) {
    return false;
  }
  
  // 기본 문자 검증 (한글, 영문, 숫자, 공백, 일부 특수문자)
  const nameRegex = /^[가-힣a-zA-Z0-9\s\-_().]+$/;
  if (!nameRegex.test(name)) {
    return false;
  }
  
  return true;
}

/**
 * 카테고리 유효성 검증
 */
function isValidCategory(category) {
  if (!category || typeof category !== 'string') {
    return false;
  }
  
  const validCategories = [
    '수강신청',
    '티켓팅',
    '쇼핑',
    '게임',
    '예약',
    '금융',
    '정부',
    '교육',
    '기타'
  ];
  
  return validCategories.includes(category);
}

/**
 * 시간 형식 검증 (ISO 8601)
 */
function isValidDateTime(dateTime) {
  if (!dateTime || typeof dateTime !== 'string') {
    return false;
  }
  
  try {
    const date = new Date(dateTime);
    
    // 유효한 날짜인지 확인
    if (isNaN(date.getTime())) {
      return false;
    }
    
    // ISO 8601 형식인지 확인
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    if (!isoRegex.test(dateTime)) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 숫자 범위 검증
 */
function isValidRange(value, min, max) {
  if (typeof value !== 'number' || isNaN(value)) {
    return false;
  }
  
  return value >= min && value <= max;
}

/**
 * IP 주소 검증
 */
function isValidIP(ip) {
  if (!ip || typeof ip !== 'string') {
    return false;
  }
  
  // IPv4 검증
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (ipv4Regex.test(ip)) {
    return true;
  }
  
  // IPv6 검증
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  if (ipv6Regex.test(ip)) {
    return true;
  }
  
  return false;
}

/**
 * 페이지네이션 파라미터 검증
 */
function validatePaginationParams(page, limit, maxLimit = 100) {
  const result = {
    valid: true,
    page: 1,
    limit: 20,
    errors: []
  };
  
  // 페이지 번호 검증
  if (page !== undefined) {
    const pageNum = parseInt(page);
    if (isNaN(pageNum) || pageNum < 1) {
      result.errors.push('페이지 번호는 1 이상이어야 합니다');
      result.valid = false;
    } else {
      result.page = pageNum;
    }
  }
  
  // 한계값 검증
  if (limit !== undefined) {
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > maxLimit) {
      result.errors.push(`한계값은 1-${maxLimit} 사이여야 합니다`);
      result.valid = false;
    } else {
      result.limit = limitNum;
    }
  }
  
  return result;
}

/**
 * 정렬 파라미터 검증
 */
function validateSortParams(sort, allowedFields = []) {
  if (!sort || typeof sort !== 'string') {
    return { valid: true, field: 'created_at', direction: 'DESC' };
  }
  
  const [field, direction = 'ASC'] = sort.split(':');
  
  if (allowedFields.length > 0 && !allowedFields.includes(field)) {
    return {
      valid: false,
      error: `허용되지 않은 정렬 필드: ${field}`
    };
  }
  
  if (!['ASC', 'DESC'].includes(direction.toUpperCase())) {
    return {
      valid: false,
      error: '정렬 방향은 ASC 또는 DESC여야 합니다'
    };
  }
  
  return {
    valid: true,
    field: field,
    direction: direction.toUpperCase()
  };
}

/**
 * 휴대폰 번호 검증 (한국)
 */
function isValidPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  
  // 하이픈 제거
  const cleanPhone = phone.replace(/-/g, '');
  
  // 한국 휴대폰 번호 형식 검증
  const phoneRegex = /^01[0-9]{8,9}$/;
  return phoneRegex.test(cleanPhone);
}

/**
 * 타임존 검증
 */
function isValidTimezone(timezone) {
  if (!timezone || typeof timezone !== 'string') {
    return false;
  }
  
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * JSON 문자열 검증
 */
function isValidJSON(jsonString) {
  try {
    JSON.parse(jsonString);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 레벤슈타인 거리 계산 (문자열 유사도)
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * 문자열 유사도 계산 (0-1 범위)
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

module.exports = {
  isValidUrl,
  isValidEmail,
  validatePasswordStrength,
  isValidUsername,
  isValidSiteName,
  isValidCategory,
  isValidDateTime,
  isValidRange,
  isValidIP,
  validatePaginationParams,
  validateSortParams,
  isValidPhoneNumber,
  isValidTimezone,
  isValidJSON,
  levenshteinDistance,
  calculateSimilarity
};