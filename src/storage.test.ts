import { describe, expect, test } from "vitest";
import { createMeal } from "./domain";
import { createDietStore } from "./storage";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length(): number {
    return this.values.size;
  }
  clear(): void {
    this.values.clear();
  }
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("createDietStore", () => {
  test("returns default targets before the user edits them", () => {
    const store = createDietStore(new MemoryStorage());

    expect(store.loadTargets()).toEqual({ calories: 2700, protein: 135 });
  });

  test("persists target edits", () => {
    const storage = new MemoryStorage();
    const store = createDietStore(storage);

    store.saveTargets({ calories: 2500, protein: 150 });

    expect(createDietStore(storage).loadTargets()).toEqual({
      calories: 2500,
      protein: 150
    });
  });

  test("persists daily meals and recomputes totals when meals are removed", () => {
    const storage = new MemoryStorage();
    const store = createDietStore(storage);
    const meal = createMeal("m1", "第一餐", [
      { name: "香蕉", amount: "1根", calories: 105, protein: 1 }
    ]);

    store.saveDailyRecord({
      date: "20260701",
      targets: { calories: 2700, protein: 135 },
      meals: [meal],
      totals: { calories: 105, protein: 1 }
    });

    expect(store.loadDailyRecord("20260701").totals).toEqual({
      calories: 105,
      protein: 1
    });

    store.removeMeal("20260701", "m1");

    expect(store.loadDailyRecord("20260701").meals).toEqual([]);
    expect(store.loadDailyRecord("20260701").totals).toEqual({
      calories: 0,
      protein: 0
    });
  });
});
