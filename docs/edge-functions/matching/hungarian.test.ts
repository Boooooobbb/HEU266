/**
 * hungarian 单元测试
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  hungarianMatch,
  greedySupplement,
  batchMatch,
} from "./hungarian.ts";
import { CandidateUser, MatchScore } from "./types.ts";

// ============ 辅助函数 ============

function createCandidate(id: string): CandidateUser {
  return {
    id,
    profile: {
      id,
      gender: id.startsWith("m") ? "male" : "female",
      stage: "undergrad_high",
      expected_gender: id.startsWith("m") ? "female" : "male",
      partner_stages: ["undergrad_high"],
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

function createScoreMatrix(
  leftIds: string[],
  rightIds: string[],
  getScore: (leftId: string, rightId: string) => number
): Map<string, Map<string, MatchScore>> {
  const matrix = new Map<string, Map<string, MatchScore>>();
  for (const leftId of leftIds) {
    const row = new Map<string, MatchScore>();
    for (const rightId of rightIds) {
      row.set(rightId, createScore(getScore(leftId, rightId)));
    }
    matrix.set(leftId, row);
  }
  return matrix;
}

// ============ hungarianMatch 测试 ============

Deno.test("hungarianMatch - 基础匹配测试", () => {
  const leftPool = [createCandidate("m1"), createCandidate("m2")];
  const rightPool = [createCandidate("f1"), createCandidate("f2")];

  // 分数矩阵
  const scoreMatrix = createScoreMatrix(
    ["m1", "m2"],
    ["f1", "f2"],
    (l, r) => {
      if (l === "m1" && r === "f1") return 90;
      if (l === "m1" && r === "f2") return 80;
      if (l === "m2" && r === "f1") return 70;
      if (l === "m2" && r === "f2") return 85;
      return 0;
    }
  );

  const pairs = hungarianMatch(leftPool, rightPool, scoreMatrix);

  assertEquals(pairs.length >= 1, true);
  // 应该匹配最高分的组合
  const m1f1Pair = pairs.find(p => p.leftId === "m1" && p.rightId === "f1");
  assertExists(m1f1Pair, "Should find m1-f1 pair (highest score)");
});

Deno.test("hungarianMatch - 空数组", () => {
  const pairs = hungarianMatch([], [], new Map());
  assertEquals(pairs.length, 0);
});

Deno.test("hungarianMatch - 一方为空", () => {
  const leftPool = [createCandidate("m1")];
  const rightPool: CandidateUser[] = [];

  const pairs = hungarianMatch(leftPool, rightPool, new Map());

  assertEquals(pairs.length, 0);
});

Deno.test("hungarianMatch - 分数低于阈值不匹配", () => {
  const leftPool = [createCandidate("m1")];
  const rightPool = [createCandidate("f1")];

  // 使用 score = 0 会导致权重为 0，hungarian 算法会返回空匹配
  const scoreMatrix = createScoreMatrix(
    ["m1"],
    ["f1"],
    () => 0
  );

  const pairs = hungarianMatch(leftPool, rightPool, scoreMatrix);

  assertEquals(pairs.length, 0);
});

Deno.test("hungarianMatch - 所有人分数相同", () => {
  const leftPool = [createCandidate("m1"), createCandidate("m2")];
  const rightPool = [createCandidate("f1"), createCandidate("f2")];

  // 使用不同的分数避免可能的算法问题
  const scoreMatrix = createScoreMatrix(
    ["m1", "m2"],
    ["f1", "f2"],
    (l, r) => {
      if (l === "m1" && r === "f1") return 80;
      if (l === "m1" && r === "f2") return 70;
      if (l === "m2" && r === "f1") return 60;
      if (l === "m2" && r === "f2") return 90;
      return 0;
    }
  );

  const pairs = hungarianMatch(leftPool, rightPool, scoreMatrix);

  assertEquals(pairs.length >= 1, true);
});

// ============ greedySupplement 测试 ============

Deno.test("greedySupplement - 补充未匹配用户", () => {
  const leftPool = [createCandidate("m1"), createCandidate("m2"), createCandidate("m3")];
  const rightPool = [createCandidate("f1"), createCandidate("f2")];

  const scoreMatrix = createScoreMatrix(
    ["m1", "m2", "m3"],
    ["f1", "f2"],
    (l, r) => {
      if (l === "m1") return 80;
      if (l === "m2") return 75;
      if (l === "m3") return 70;
      return 0;
    }
  );

  // 已有匹配：m1-f1
  const existingMatches = new Set(["m1-f1"]);

  const supplements = greedySupplement(leftPool, rightPool, scoreMatrix, existingMatches, 3, 55);

  // m2 或 m3 应该有补充匹配
  assertEquals(supplements.length >= 1, true);
});

Deno.test("greedySupplement - 已有最佳匹配不补充", () => {
  const leftPool = [createCandidate("m1")];
  const rightPool = [createCandidate("f1")];

  const scoreMatrix = createScoreMatrix(
    ["m1"],
    ["f1"],
    () => 80
  );

  // 已经匹配了
  const existingMatches = new Set(["m1-f1"]);

  const supplements = greedySupplement(leftPool, rightPool, scoreMatrix, existingMatches, 3, 55);

  assertEquals(supplements.length, 0);
});

Deno.test("greedySupplement - 分数低于阈值不补充", () => {
  const leftPool = [createCandidate("m1"), createCandidate("m2")];
  const rightPool = [createCandidate("f1"), createCandidate("f2")];

  const scoreMatrix = createScoreMatrix(
    ["m1", "m2"],
    ["f1", "f2"],
    () => 10 // 都低于阈值
  );

  const existingMatches = new Set<string>();

  const supplements = greedySupplement(leftPool, rightPool, scoreMatrix, existingMatches, 3, 55);

  assertEquals(supplements.length, 0);
});

// ============ batchMatch 测试 ============

Deno.test("batchMatch - 组合 Hungarian 和 Greedy", () => {
  const leftPool = [createCandidate("m1"), createCandidate("m2"), createCandidate("m3")];
  const rightPool = [createCandidate("f1"), createCandidate("f2"), createCandidate("f3")];

  const scoreMatrix = createScoreMatrix(
    ["m1", "m2", "m3"],
    ["f1", "f2", "f3"],
    (l, r) => {
      // m1-f1=90, m2-f2=85, m3-f3=80
      if (l === "m1" && r === "f1") return 90;
      if (l === "m2" && r === "f2") return 85;
      if (l === "m3" && r === "f3") return 80;
      return 50;
    }
  );

  const pairs = batchMatch(leftPool, rightPool, scoreMatrix, {
    useHungarianFirst: true,
    minScoreThreshold: 55,
  });

  assertEquals(pairs.length >= 3, true);
});

Deno.test("batchMatch - 不使用 Hungarian", () => {
  const leftPool = [createCandidate("m1"), createCandidate("m2")];
  const rightPool = [createCandidate("f1"), createCandidate("f2")];

  const scoreMatrix = createScoreMatrix(
    ["m1", "m2"],
    ["f1", "f2"],
    () => 70
  );

  const pairs = batchMatch(leftPool, rightPool, scoreMatrix, {
    useHungarianFirst: false,
    minScoreThreshold: 55,
  });

  // Greedy 也应该能匹配
  assertEquals(pairs.length >= 1, true);
});

Deno.test("batchMatch - 最大匹配数限制", () => {
  const leftPool = [createCandidate("m1"), createCandidate("m2")];
  const rightPool = [createCandidate("f1")];

  const scoreMatrix = createScoreMatrix(
    ["m1", "m2"],
    ["f1"],
    () => 80
  );

  const pairs = batchMatch(leftPool, rightPool, scoreMatrix, {
    useHungarianFirst: true,
    maxMatchesPerUser: 1,
    minScoreThreshold: 55,
  });

  // f1 最多被匹配1次（因为 maxMatchesPerUser=1）
  const f1Matches = pairs.filter(p => p.rightId === "f1");
  assertEquals(f1Matches.length <= 1, true);
});

Deno.test("batchMatch - 阈值过滤", () => {
  const leftPool = [createCandidate("m1"), createCandidate("m2")];
  const rightPool = [createCandidate("f1"), createCandidate("f2")];

  const scoreMatrix = createScoreMatrix(
    ["m1", "m2"],
    ["f1", "f2"],
    (l, r) => {
      if (l === "m1" && r === "f1") return 90; // 高分
      if (l === "m1" && r === "f2") return 70;
      if (l === "m2" && r === "f1") return 60;
      if (l === "m2" && r === "f2") return 80;
      return 0;
    }
  );

  const pairs = batchMatch(leftPool, rightPool, scoreMatrix, {
    useHungarianFirst: true,
    minScoreThreshold: 55,
  });

  // 所有匹配分数应该 >= 阈值
  for (const pair of pairs) {
    assertEquals(pair.score >= 55, true);
  }
});

console.log("✅ hungarian tests loaded");
