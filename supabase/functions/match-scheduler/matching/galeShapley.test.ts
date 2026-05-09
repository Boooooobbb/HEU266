/**
 * galeShapley 单元测试
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  runGaleShapleyMatching,
  groupUsersByPreference,
  buildScoreMatrix,
} from "./galeShapley.ts";
import { CandidateUser, MatchScore, UserProfile, MAX_MATCHES_PER_USER, MIN_SCORE_THRESHOLD } from "./types.ts";

// ============ 辅助函数 ============

function createCandidate(id: string, gender: "male" | "female", expectedGender: "male" | "female" | "both"): CandidateUser {
  return {
    id,
    profile: {
      id,
      gender,
      stage: "undergrad_high",
      expected_gender: expectedGender,
      partner_stages: ["undergrad_high", "master"],
      locations: ["图书馆"],
    },
    questionnaire: {},
    matchState: {
      preferences: [],
      receivedOffers: new Map(),
      matchedUsers: [],
      rejectedOffers: new Set(),
    },
  };
}

function createScore(total: number): MatchScore {
  return {
    total,
    dimensions: {
      valueAlignment: total * 0.2,
      lifestyleFit: total * 0.15,
      personalityMatch: total * 0.25,
      interestOverlap: total * 0.2,
      expectationMatch: total * 0.2,
    },
  };
}

function createScoreMatrix(candidates: CandidateUser[], getScore: (a: CandidateUser, b: CandidateUser) => MatchScore): Map<string, Map<string, MatchScore>> {
  const matrix = new Map<string, Map<string, MatchScore>>();
  for (const a of candidates) {
    const row = new Map<string, MatchScore>();
    for (const b of candidates) {
      if (a.id === b.id) continue;
      row.set(b.id, getScore(a, b));
    }
    matrix.set(a.id, row);
  }
  return matrix;
}

// ============ groupUsersByPreference 测试 ============

Deno.test("groupUsersByPreference - 正确分组", () => {
  const candidates = [
    createCandidate("m1", "male", "female"),   // malePreferFemale
    createCandidate("f1", "female", "male"),    // femalePreferMale
    createCandidate("m2", "male", "both"),      // bothPool
    createCandidate("f2", "female", "both"),    // bothPool
    createCandidate("m3", "male", "female"),    // malePreferFemale
  ];

  const groups = groupUsersByPreference(candidates);

  assertEquals(groups.malePreferFemale.length, 2);
  assertEquals(groups.femalePreferMale.length, 1);
  assertEquals(groups.bothPool.length, 2);
});

Deno.test("groupUsersByPreference - 空数组", () => {
  const groups = groupUsersByPreference([]);

  assertEquals(groups.malePreferFemale.length, 0);
  assertEquals(groups.femalePreferMale.length, 0);
  assertEquals(groups.bothPool.length, 0);
});

Deno.test("groupUsersByPreference - 全部是 both", () => {
  const candidates = [
    createCandidate("m1", "male", "both"),
    createCandidate("f1", "female", "both"),
  ];

  const groups = groupUsersByPreference(candidates);

  assertEquals(groups.malePreferFemale.length, 0);
  assertEquals(groups.femalePreferMale.length, 0);
  assertEquals(groups.bothPool.length, 2);
});

// ============ buildScoreMatrix 测试 ============

Deno.test("buildScoreMatrix - 正确构建矩阵", () => {
  const candidates = [
    createCandidate("a", "male", "female"),
    createCandidate("b", "female", "male"),
    createCandidate("c", "male", "female"),
  ];

  const scoreMatrix = buildScoreMatrix(candidates, (a, b) => createScore(80));

  assertEquals(scoreMatrix.has("a"), true);
  assertEquals(scoreMatrix.has("b"), true);
  assertEquals(scoreMatrix.has("c"), true);
  assertEquals(scoreMatrix.get("a")!.has("a"), false); // 不包含自己
  assertEquals(scoreMatrix.get("a")!.has("b"), true);
  assertEquals(scoreMatrix.get("a")!.get("b")!.total, 80);
});

Deno.test("buildScoreMatrix - 过滤掉0分", () => {
  const candidates = [
    createCandidate("a", "male", "female"),
    createCandidate("b", "female", "male"),
  ];

  const scoreMatrix = buildScoreMatrix(candidates, (a, b) => createScore(0));

  // 0分的配对不应该被添加
  assertEquals(scoreMatrix.get("a")!.size, 0);
});

// ============ runGaleShapleyMatching 测试 ============

Deno.test("runGaleShapleyMatching - 基础匹配测试", async () => {
  const candidates = [
    createCandidate("m1", "male", "female"),
    createCandidate("f1", "female", "male"),
  ];

  const scoreMatrix = createScoreMatrix(candidates, () => createScore(80));

  const results = await runGaleShapleyMatching(candidates, "2024-W01", scoreMatrix);

  assertEquals(results.length >= 1, true); // 至少有一个匹配
});

Deno.test("runGaleShapleyMatching - 用户数量不足", async () => {
  const candidates = [
    createCandidate("m1", "male", "female"),
  ];

  const scoreMatrix = createScoreMatrix(candidates, () => createScore(80));

  const results = await runGaleShapleyMatching(candidates, "2024-W01", scoreMatrix);

  assertEquals(results.length, 0);
});

Deno.test("runGaleShapleyMatching - 多对匹配", async () => {
  const candidates = [
    createCandidate("m1", "male", "female"),
    createCandidate("m2", "male", "female"),
    createCandidate("m3", "male", "female"),
    createCandidate("f1", "female", "male"),
    createCandidate("f2", "female", "male"),
    createCandidate("f3", "female", "male"),
  ];

  // 所有人互给80分
  const scoreMatrix = createScoreMatrix(candidates, () => createScore(80));

  const results = await runGaleShapleyMatching(candidates, "2024-W01", scoreMatrix);

  // 应该有匹配结果（多对匹配）
  assertEquals(results.length >= 1, true);
});

Deno.test("runGaleShapleyMatching - 分数低于阈值不匹配", async () => {
  const candidates = [
    createCandidate("m1", "male", "female"),
    createCandidate("f1", "female", "male"),
  ];

  // 分数低于阈值
  const scoreMatrix = createScoreMatrix(candidates, () => createScore(MIN_SCORE_THRESHOLD - 10));

  const results = await runGaleShapleyMatching(candidates, "2024-W01", scoreMatrix);

  assertEquals(results.length, 0);
});

Deno.test("runGaleShapleyMatching - 匹配结果包含正确字段", async () => {
  const candidates = [
    createCandidate("m1", "male", "female"),
    createCandidate("f1", "female", "male"),
  ];

  const scoreMatrix = createScoreMatrix(candidates, () => createScore(80));

  const results = await runGaleShapleyMatching(candidates, "2024-W01", scoreMatrix);

  if (results.length > 0) {
    const match = results[0];
    assertExists(match.id);
    assertExists(match.userAId);
    assertExists(match.userBId);
    assertExists(match.score);
    assertEquals(match.weekTag, "2024-W01");
    assertEquals(match.status, "pending");
  }
});

Deno.test("runGaleShapleyMatching - 配对ID唯一性（无重复）", async () => {
  const candidates = [
    createCandidate("m1", "male", "female"),
    createCandidate("m2", "male", "female"),
    createCandidate("f1", "female", "male"),
    createCandidate("f2", "female", "male"),
  ];

  const scoreMatrix = createScoreMatrix(candidates, () => createScore(80));

  const results = await runGaleShapleyMatching(candidates, "2024-W01", scoreMatrix);

  // 检查是否有重复配对
  const pairKeys = new Set<string>();
  for (const match of results) {
    const key = match.userAId < match.userBId
      ? `${match.userAId}-${match.userBId}`
      : `${match.userBId}-${match.userAId}`;
    assertEquals(pairKeys.has(key), false, `Duplicate pair: ${key}`);
    pairKeys.add(key);
  }
});

Deno.test("runGaleShapleyMatching - 高分会优先匹配", async () => {
  const candidates = [
    createCandidate("m1", "male", "female"),
    createCandidate("f1", "female", "male"),
    createCandidate("f2", "female", "male"),
  ];

  // m1给f1高分(90)，给f2低分(60)；f1给m1高分(90)，f2给m1低分(60)
  const scoreMatrix = new Map<string, Map<string, MatchScore>>();

  // m1的评分
  const m1Row = new Map<string, MatchScore>();
  m1Row.set("f1", createScore(90));
  m1Row.set("f2", createScore(60));
  scoreMatrix.set("m1", m1Row);

  // f1的评分
  const f1Row = new Map<string, MatchScore>();
  f1Row.set("m1", createScore(90));
  f1Row.set("m1", createScore(90)); // 实际上只取第一个
  scoreMatrix.set("f1", f1Row);

  // f2的评分
  const f2Row = new Map<string, MatchScore>();
  f2Row.set("m1", createScore(60));
  scoreMatrix.set("f2", f2Row);

  // 添加f1对m1
  scoreMatrix.get("f1")!.set("m1", createScore(90));
  scoreMatrix.get("f2")!.set("m1", createScore(60));

  const results = await runGaleShapleyMatching(candidates, "2024-W01", scoreMatrix);

  // m1 和 f1 应该优先匹配
  const m1f1Match = results.find(m =>
    (m.userAId === "m1" && m.userBId === "f1") ||
    (m.userAId === "f1" && m.userBId === "m1")
  );
  assertExists(m1f1Match, "m1 and f1 should match (highest scores)");
});

console.log("✅ galeShapley tests loaded");
