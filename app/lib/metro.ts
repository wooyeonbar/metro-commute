// 서울 실시간 지하철 도착정보 조회 + 정제 (서버 전용)
// 환경변수로 역/호선/방향을 고정해두면 출근 동선 하나만 본다.

export type Arrival = {
  line: string;        // 호선 이름
  direction: string;   // 상행/하행
  dest: string;        // 종착역
  message: string;     // "3분 후 (충무로)" 같은 도착 메시지
  heading: string;     // "동대문역사문화공원방면" 같은 진행 방면
  minutes: number | null; // 도착까지 분 (없으면 null → message 참고)
  express: boolean;    // 급행 여부
};

// subwayId → 호선 이름 (필요한 것만, 나머지는 코드 그대로 표시)
const LINE_NAME: Record<string, string> = {
  "1001": "1호선", "1002": "2호선", "1003": "3호선", "1004": "4호선",
  "1005": "5호선", "1006": "6호선", "1007": "7호선", "1008": "8호선",
  "1009": "9호선", "1063": "경의중앙", "1065": "공항철도", "1067": "경춘",
  "1075": "수인분당", "1077": "신분당", "1092": "우이신설",
};

type Opts = {
  station?: string;            // 역 이름 override (없으면 env STATION)
  // direction: 문자열이면 그 방향만, null이면 양방향 전부, undefined면 env 기본값
  direction?: string | null;
  subwayId?: string;
};

export async function getArrivals(opts: Opts = {}): Promise<Arrival[]> {
  const key = process.env.SEOUL_API_KEY;
  const station = opts.station ?? process.env.STATION;        // 예: "충무로"
  const subwayId = opts.subwayId ?? process.env.SUBWAY_ID;    // 예: "1004" (선택, 환승역이면 권장)
  // direction이 인자로 안 들어오면(undefined) env값 사용, ""/null이면 양방향
  const direction =
    opts.direction === undefined ? process.env.DIRECTION : opts.direction || "";

  if (!key || !station) throw new Error("SEOUL_API_KEY / STATION 환경변수 필요");

  const url = `http://swopenapi.seoul.go.kr/api/subway/${key}/json/realtimeStationArrival/0/15/${encodeURIComponent(
    station
  )}`;

  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  const list: any[] = data?.realtimeArrivalList ?? [];

  return list
    .filter((t) => (subwayId ? t.subwayId === subwayId : true))
    .filter((t) => (direction ? t.updnLine === direction : true))
    .map((t) => {
      const sec = Number(t.barvlDt);
      return {
        line: LINE_NAME[t.subwayId] ?? t.subwayId,
        direction: t.updnLine,
        dest: t.bstatnNm,
        message: t.arvlMsg2, // 사람이 읽는 메시지가 가장 정확
        heading: String(t.trainLineNm ?? "").split(" - ")[1] ?? "",
        minutes: sec > 0 ? Math.round(sec / 60) : null,
        express: String(t.btrainSttus ?? "").includes("급행"),
      } as Arrival;
    })
    .sort((a, b) => (a.minutes ?? 999) - (b.minutes ?? 999));
}
