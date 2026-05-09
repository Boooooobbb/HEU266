/**
 * Hungarian 算法调试脚本
 */

import { CandidateUser } from "./types.ts";
import { hungarianMatch } from "./hungarian.ts";

function createCandidate(id: string): CandidateUser {
  return {
    id,
    profile: {
      id,
      gender: id.startsWith("m") ? "male" : "female",
      stage: "undergrad_high",
      expected_gender: "female",
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

interface MatchScore {
  total: number;
  dimensions: {
    valueAlignment: number;
    lifestyleFit: number;
    personalityMatch: number;
    interestOverlap: number;
    expectationMatch: number;
  };
}

// 简单测试
console.log("=== 测试1: 简单2x2矩阵 ===");
{
  const leftPool = [createCandidate("m1"), createCandidate("m2")];
  const rightPool = [createCandidate("f1"), createCandidate("f2")];

  const scoreMatrix = new Map<string, Map<string, MatchScore>>();
  const scores = [[90, 80], [70, 85]]; // m1-f1=90, m1-f2=80, m2-f1=70, m2-f2=85

  for (let i = 0; i < 2; i++) {
    const row = new Map<string, MatchScore>();
    for (let j = 0; j < 2; j++) {
      row.set(rightPool[j].id, { total: scores[i][j], dimensions: {} as any });
    }
    scoreMatrix.set(leftPool[i].id, row);
  }

  console.log("分数矩阵:");
  for (const [leftId, row] of scoreMatrix) {
    for (const [rightId, score] of row) {
      console.log(`  ${leftId}-${rightId}: ${score.total}`);
    }
  }

  console.log("调用 hungarianMatch...");
  const pairs = hungarianMatch(leftPool, rightPool, scoreMatrix);
  console.log(`结果: ${JSON.stringify(pairs)}`);
}

console.log("\n=== 测试2: 所有分数相同 ===");
{
  const leftPool = [createCandidate("m1"), createCandidate("m2")];
  const rightPool = [createCandidate("f1"), createCandidate("f2")];

  const scoreMatrix = new Map<string, Map<string, MatchScore>>();
  const scores = [[80, 80], [80, 80]]; // 所有分数相同

  for (let i = 0; i < 2; i++) {
    const row = new Map<string, MatchScore>();
    for (let j = 0; j < 2; j++) {
      row.set(rightPool[j].id, { total: scores[i][j], dimensions: {} as any });
    }
    scoreMatrix.set(leftPool[i].id, row);
  }

  console.log("调用 hungarianMatch...");
  const pairs = hungarianMatch(leftPool, rightPool, scoreMatrix);
  console.log(`结果: ${JSON.stringify(pairs)}`);
}

console.log("\n=== 测试3: 有0分 ===");
{
  const leftPool = [createCandidate("m1"), createCandidate("m2")];
  const rightPool = [createCandidate("f1"), createCandidate("f2")];

  const scoreMatrix = new Map<string, Map<string, MatchScore>>();
  const scores = [[80, 0], [0, 80]]; // 交叉为0

  for (let i = 0; i < 2; i++) {
    const row = new Map<string, MatchScore>();
    for (let j = 0; j < 2; j++) {
      row.set(rightPool[j].id, { total: scores[i][j], dimensions: {} as any });
    }
    scoreMatrix.set(leftPool[i].id, row);
  }

  console.log("调用 hungarianMatch...");
  const pairs = hungarianMatch(leftPool, rightPool, scoreMatrix);
  console.log(`结果: ${JSON.stringify(pairs)}`);
}

console.log("\n=== 测试4: 低分数 ===");
{
  const leftPool = [createCandidate("m1"), createCandidate("m2")];
  const rightPool = [createCandidate("f1"), createCandidate("f2")];

  const scoreMatrix = new Map<string, Map<string, MatchScore>>();
  const scores = [[12, 10], [11, 13]]; // 低分数

  for (let i = 0; i < 2; i++) {
    const row = new Map<string, MatchScore>();
    for (let j = 0; j < 2; j++) {
      row.set(rightPool[j].id, { total: scores[i][j], dimensions: {} as any });
    }
    scoreMatrix.set(leftPool[i].id, row);
  }

  console.log("调用 hungarianMatch...");
  const pairs = hungarianMatch(leftPool, rightPool, scoreMatrix);
  console.log(`结果: ${JSON.stringify(pairs)}`);
}

console.log("\n=== 测试5: 4x4中等规模 ===");
{
  const leftPool = [createCandidate("m1"), createCandidate("m2"), createCandidate("m3"), createCandidate("m4")];
  const rightPool = [createCandidate("f1"), createCandidate("f2"), createCandidate("f3"), createCandidate("f4")];

  const scoreMatrix = new Map<string, Map<string, MatchScore>>();
  const scores = [
    [14, 12, 13, 15],
    [12, 15, 11, 13],
    [15, 13, 14, 12],
    [11, 14, 12, 15]
  ];

  for (let i = 0; i < 4; i++) {
    const row = new Map<string, MatchScore>();
    for (let j = 0; j < 4; j++) {
      row.set(rightPool[j].id, { total: scores[i][j], dimensions: {} as any });
    }
    scoreMatrix.set(leftPool[i].id, row);
  }

  console.log("调用 hungarianMatch...");
  const pairs = hungarianMatch(leftPool, rightPool, scoreMatrix);
  console.log(`结果: ${JSON.stringify(pairs)}`);
}

console.log("\n=== 测试6: 实际压力测试中的数据 ===");
{
  // 使用压力测试中产生数据的配置
  const leftPool = [];
  const rightPool = [];
  for (let i = 0; i < 10; i++) {
    leftPool.push(createCandidate(`m${i}`));
    rightPool.push(createCandidate(`f${i}`));
  }

  const scoreMatrix = new Map<string, Map<string, MatchScore>>();

  // 生成10-15范围内的随机分数
  for (let i = 0; i < 10; i++) {
    const row = new Map<string, MatchScore>();
    for (let j = 0; j < 10; j++) {
      const score = 10 + Math.random() * 5; // 10-15
      row.set(rightPool[j].id, { total: Math.round(score * 100) / 100, dimensions: {} as any });
    }
    scoreMatrix.set(leftPool[i].id, row);
  }

  console.log("分数范围: 10-15");
  console.log("调用 hungarianMatch...");
  const pairs = hungarianMatch(leftPool, rightPool, scoreMatrix);
  console.log(`结果: ${JSON.stringify(pairs)}`);
}

console.log("\n调试完成");