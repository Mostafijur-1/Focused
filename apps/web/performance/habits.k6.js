import http from "k6/http";
import { check } from "k6";

export const options = {
  scenarios: {
    habit_reads: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.RATE || 25),
      timeUnit: "1s",
      duration: __ENV.DURATION || "2m",
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500", "p(99)<1000"],
    checks: ["rate>0.99"],
  },
};

const baseUrl = (__ENV.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/u, "");

export default function habitReadScenario() {
  const response = http.get(`${baseUrl}/api/v1/habits`, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${__ENV.ACCESS_TOKEN || ""}`,
    },
    tags: { feature: "habits", operation: "list" },
  });
  check(response, {
    "habit list returns 200": (result) => result.status === 200,
    "habit list is private": (result) =>
      result.headers["Cache-Control"] === "private, no-store",
  });
}
