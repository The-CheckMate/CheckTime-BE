-------------------------------------------------
--- `티켓팅` 카테고리 사이트 수동 등록 ---
-------------------------------------------------
-- 공연 및 문화 예술 티켓팅
INSERT INTO sites (url, name, category, description, keywords) VALUES
('https://ticket.interpark.com/', '인터파크 티켓', '티켓팅', '뮤지컬, 콘서트, 연극, 스포츠 등 다양한 티켓 예매', '{"인터파크", "티켓팅", "뮤지컬", "콘서트", "연극", "스포츠"}'),
('https://ticket.yes24.com/', '예스24 티켓', '티켓팅', '공연, 전시, 영화 예매', '{"예스24", "티켓팅", "콘서트", "뮤지컬", "아이돌"}'),
('https://ticket.melon.com/', '멜론 티켓', '티켓팅', '콘서트, 팬미팅 등 음악 관련 티켓 예매', '{"멜론", "티켓팅", "콘서트", "팬미팅"}'),
('https://www.livenation.kr/', '라이브네이션코리아', '티켓팅', '해외 아티스트 내한 공연 전문 예매', '{"라이브네이션", "내한공연", "해외가수", "콘서트"}'),
('https://www.lotteticket.com/', '롯데콘서트홀', '티켓팅', '클래식 공연 및 롯데 계열사 공연 예매', '{"롯데콘서트홀", "클래식", "오케스트라"}'),
('https://www.sejongpac.or.kr/', '세종문화회관', '티켓팅', '세종문화회관 공연 예매', '{"세종문화회관", "뮤지컬", "연극", "클래식"}'),
('https://timeticket.co.kr/', '타임티켓', '티켓팅', '마감 임박 공연 할인 판매', '{"타임티켓", "할인티켓", "연극", "뮤지컬"}'),
('https://www.sangsangmadang.com/ticket/list.asp', 'KT&G 상상마당', '티켓팅', '인디 음악, 영화, 전시 등 문화 이벤트', '{"상상마당", "인디음악", "영화제"}'),
('https://www.sejongculture.or.kr/ticket/', '세종문화회관 티켓', '티켓팅', '세종문화회관 공식 예매 채널', '{"세종문화회관", "공연"}'),
('https://www.sac.or.kr/', '예술의전당', '티켓팅', '예술의전당 공연 및 전시 예매', '{"예술의전당", "클래식", "발레", "오페라"}'),
('https://ticket.arte.co.kr/', '아르떼 티켓', '티켓팅', '클래식, 연극, 전시 등 문화예술 공연 예매', '{"아르떼", "클래식", "예술", "공연"}'),
('https://www.playdb.co.kr/playdb/Ticket.asp', '플레이디비', '티켓팅', '뮤지컬, 연극 등 공연 정보 및 예매', '{"플레이디비", "뮤지컬", "연극", "공연"}'),
('https://ticket.weverse.io/', '위버스샵', '티켓팅', '하이브 소속 아티스트 공식 팬클럽 및 공연 예매', '{"위버스", "방탄소년단", "세븐틴", "팬미팅"}'),
('https://www.sistic.com.sg/', '시스틱', '티켓팅', '싱가포르 티켓팅 (해외 티켓팅)', '{"시스틱", "싱가포르", "해외공연"}') ON CONFLICT (url) DO NOTHING;


-- 스포츠 티켓팅
INSERT INTO sites (url, name, category, description, keywords) VALUES
('https://www.ticketlink.co.kr/', '티켓링크', '티켓팅', '스포츠, 프로야구 등 경기 티켓 예매', '{"티켓링크", "스포츠", "야구", "농구", "축구", "티켓"}'),
('https://smartticket.kbo.or.kr/main', 'KBO 프로야구', '티켓팅', '한국 프로야구 티켓 예매 통합', '{"KBO", "야구", "프로야구"}'),
('https://www.kbovision.com/', 'KBO 비전', '티켓팅', 'KBO 프로야구 공식 예매 채널', '{"KBO", "야구", "프로야구"}'),
('https://www.ticketkfa.com/', '대한축구협회 티켓', '티켓팅', '축구 국가대표팀 경기 및 KFA 주최 경기 예매', '{"대한축구협회", "축구", "국가대표", "A매치"}'),
('https://tickets.kfa.or.kr/', 'KFA 통합 티켓', '티켓팅', '대한축구협회 통합 티켓 시스템', '{"축구협회", "KFA", "축구티켓", "경기"}'),
('https://tickets.kbl.or.kr/', 'KBL 티켓', '티켓팅', '한국 프로농구 경기 티켓 예매', '{"농구", "KBL", "프로농구"}'),
('https://tickets.goallive.com/', '골라이브 티켓', '티켓팅', '축구 경기 티켓 예매 전문', '{"골라이브", "축구", "K리그", "해외축구"}'),
('https://www.ufc.com/tickets', 'UFC 공식 티켓', '티켓팅', 'UFC 격투기 경기 공식 티켓 (해외)', '{"UFC", "격투기", "티켓"}'),
('https://www.stadium.or.kr/main/main.asp', '경기장 공식 티켓', '티켓팅', '국내 주요 경기장 이벤트 티켓', '{"경기장", "공연장", "티켓"}'),
('https://tickets.nba.com/', 'NBA 공식 티켓', '티켓팅', 'NBA 농구 경기 공식 티켓 (해외)', '{"NBA", "농구", "미국농구"}'),
('https://www.ticketlink.co.kr/sports/', '티켓링크 스포츠', '티켓팅', '스포츠 경기 전문 예매 (티켓링크 하위)', '{"티켓링크", "스포츠", "야구", "농구"}') ON CONFLICT (url) DO NOTHING;

-- 영화 및 기타
INSERT INTO sites (url, name, category, description, keywords) VALUES
('https://www.ticketbay.co.kr/', '티켓베이', '티켓팅', '티켓 양도 및 재판매 플랫폼', '{"티켓베이", "티켓양도", "재판매", "중고티켓"}'),
('https://ticket.cgv.co.kr/Movie/MovieHome.aspx', 'CGV', '티켓팅', '영화 예매', '{"CGV", "영화", "영화관"}'),
('https://m.cgv.co.kr/Ticket/', 'CGV 모바일 티켓', '티켓팅', 'CGV 모바일 영화 예매', '{"CGV", "모바일", "영화"}'),
('https://www.maxmovie.com/', '맥스무비', '티켓팅', '영화 예매 및 할인 정보 제공', '{"맥스무비", "영화", "영화예매"}'),
('https://www.lotteticket.com/ticket_web/play/main.do', '롯데시네마 티켓', '티켓팅', '롯데시네마 영화 예매 및 이벤트', '{"롯데시네마", "영화", "영화예매"}'),
('https://www.lotte.com/lotteticket/center/ticket_main', '롯데백화점 티켓', '티켓팅', '롯데 계열사 문화 이벤트 및 공연 티켓', '{"롯데", "롯데백화점", "공연"}'),
('https://www.ticketmaster.com/', '티켓마스터', '티켓팅', '글로벌 최대 티켓 판매 사이트', '{"티켓마스터", "해외티켓", "콘서트"}'),
('https://www.gmarket.co.kr/st/ticket/event/ticket_main', 'G마켓 티켓', '티켓팅', 'G마켓에서 제공하는 티켓 서비스', '{"G마켓", "티켓", "뮤지컬"}'),
('https://www.11st.co.kr/main/main.do', '11번가 티켓', '티켓팅', '11번가에서 제공하는 티켓 서비스', '{"11번가", "티켓", "공연"}'),
('https://www.wemakeprice.com/ticket/', '위메프 티켓', '티켓팅', '위메프에서 제공하는 공연 및 전시 티켓', '{"위메프", "티켓", "공연", "전시"}'),
('https://www.ticketmonster.co.kr/ticket/', '티몬 티켓', '티켓팅', '티몬에서 판매하는 공연 및 전시 티켓', '{"티몬", "공연", "전시"}'),
('https://www.samsung.com/sec/ticket-shop/', '삼성닷컴 티켓', '티켓팅', '삼성카드 고객 대상 공연 예매', '{"삼성", "삼성닷컴", "콘서트"}'),
('https://www.ticket-portal.com/', '티켓포털', '티켓팅', '국내외 다양한 이벤트 티켓 예매', '{"티켓포털", "이벤트", "티켓"}'),
('https://www.ticket.co.kr/', '티켓코리아', '티켓팅', '소규모 공연, 스포츠 등 티켓 예매', '{"티켓코리아", "티켓"}') ON CONFLICT (url) DO NOTHING;
