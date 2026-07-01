import {
  buildDailyRecord,
  deleteMeal,
  type DailyRecord,
  type NutritionTargets
} from "./domain";

const TARGETS_KEY = "diet-photo-annotation:targets";
const RECORD_PREFIX = "diet-photo-annotation:record:";
const DEFAULT_TARGETS: NutritionTargets = { calories: 2700, protein: 135 };

export type DietStore = {
  loadTargets(): NutritionTargets;
  saveTargets(targets: NutritionTargets): void;
  loadDailyRecord(dateKey: string): DailyRecord;
  saveDailyRecord(record: DailyRecord): void;
  removeMeal(dateKey: string, mealId: string): DailyRecord;
};

export function createDietStore(storage: Storage): DietStore {
  return {
    loadTargets() {
      const stored = readJson<NutritionTargets>(storage, TARGETS_KEY);
      if (!stored) {
        return DEFAULT_TARGETS;
      }
      return normalizeTargets(stored);
    },
    saveTargets(targets) {
      storage.setItem(TARGETS_KEY, JSON.stringify(normalizeTargets(targets)));
    },
    loadDailyRecord(dateKey) {
      const targets = this.loadTargets();
      const stored = readJson<DailyRecord>(storage, `${RECORD_PREFIX}${dateKey}`);
      if (!stored) {
        return buildDailyRecord(dateKey, targets, []);
      }
      return buildDailyRecord(dateKey, targets, stored.meals ?? []);
    },
    saveDailyRecord(record) {
      storage.setItem(
        `${RECORD_PREFIX}${record.date}`,
        JSON.stringify(buildDailyRecord(record.date, record.targets, record.meals))
      );
    },
    removeMeal(dateKey, mealId) {
      const next = deleteMeal(this.loadDailyRecord(dateKey), mealId);
      this.saveDailyRecord(next);
      return next;
    }
  };
}

function readJson<T>(storage: Storage, key: string): T | null {
  const raw = storage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeTargets(targets: NutritionTargets): NutritionTargets {
  return {
    calories: Number.isFinite(targets.calories) ? targets.calories : DEFAULT_TARGETS.calories,
    protein: Number.isFinite(targets.protein) ? targets.protein : DEFAULT_TARGETS.protein
  };
}
