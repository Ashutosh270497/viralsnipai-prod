import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    read_heavy: {
      executor: "ramping-vus",
      startVUs: 5,
      stages: [
        { duration: "1m", target: 25 },
        { duration: "2m", target: 75 },
        { duration: "2m", target: 125 },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<900", "p(99)<1800"],
    http_req_failed: ["rate<0.03"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const AUTH_COOKIE = __ENV.SNIPRADAR_AUTH_COOKIE || "";

function requestOptions() {
  const headers = {};
  if (AUTH_COOKIE) {
    headers.Cookie = AUTH_COOKIE;
  }
  return { headers };
}

function get(path) {
  return http.get(`${BASE_URL}${path}`, requestOptions());
}

export default function () {
  const endpoints = [
    "/api/snipradar",
    "/api/snipradar/discover-data",
    "/api/snipradar/create-data",
    "/api/snipradar/engagement?niche=tech&status=all&page=1&pageSize=10&sortBy=score&minScore=0",
    "/api/snipradar/metrics?periodDays=30",
    "/api/snipradar/health",
    "/api/snipradar/scheduled/runs?limit=20",
  ];

  const responses = endpoints.map((path) => get(path));

  for (const res of responses) {
    check(res, {
      "status is 200 or 401": (r) => r.status === 200 || r.status === 401,
      "server timing present": (r) => {
        const timing = r.headers["Server-Timing"];
        return typeof timing === "string" && timing.length > 0;
      },
    });
  }

  sleep(1);
}
