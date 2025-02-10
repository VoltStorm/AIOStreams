import { compressedConfigMap } from './details';

export const getTimeTakenSincePoint = (point: number) => {
  const timeNow = new Date().getTime();
  const duration = timeNow - point;
  // format duration and choose unit and return
  const nanos = duration * 1_000_000; // Convert to nanoseconds
  const micros = duration * 1_000; // Convert to microseconds

  if (nanos < 1) {
    return `${nanos.toFixed(2)}ns`;
  } else if (micros < 1) {
    return `${micros.toFixed(2)}µs`;
  } else if (duration < 1000) {
    return `${duration.toFixed(2)}ms`;
  } else {
    return `${(duration / 1000).toFixed(2)}s`;
  }
};
const MINIFY_SUFFIX = '__ignore';
const MAX_DEPTH = 50;
const MAX_KEYS = 200;

export function minifyConfig(obj: any, depth: number = 0): any {
  if (depth > MAX_DEPTH) {
    throw new Error('Max depth reached');
  }
  if (typeof obj !== 'object' || obj === null) {
    if (Object.values(compressedConfigMap).includes(obj)) {
      return `${obj}${MINIFY_SUFFIX}`;
    }
    return compressedConfigMap[obj] ?? obj;
  }

  if (Array.isArray(obj)) {
    if (obj.length > MAX_KEYS) {
      throw new Error('Max keys reached');
    }
    return obj.map((item) => minifyConfig(item, depth + 1));
  }
  console.log('Object.keys(obj).length', Object.keys(obj).length);
  if (Object.keys(obj).length > MAX_KEYS) {
    throw new Error('Max keys reached');
  }

  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => {
      const newKey = compressedConfigMap[key] ?? key;
      const newValue = minifyConfig(value, depth + 1);
      return [newKey, newValue];
    })
  );
}

export function unminifyConfig(obj: any, depth: number = 0): any {
  if (depth > MAX_DEPTH) {
    throw new Error('Max depth reached');
  }
  const reversedMap = reverseConfigMap();

  if (typeof obj !== 'object' || obj === null) {
    if (typeof obj === 'string' && obj.endsWith(MINIFY_SUFFIX)) {
      return obj.slice(0, -MINIFY_SUFFIX.length);
    }
    const originalKey = reversedMap[obj] ?? obj;
    if (originalKey === 'true' || originalKey === 'false') {
      return originalKey === 'true';
    }
    if (originalKey === 'null') {
      return null;
    }
    return originalKey;
  }

  if (Array.isArray(obj)) {
    if (obj.length > MAX_KEYS) {
      throw new Error('Max keys reached');
    }
    return obj.map((item) => unminifyConfig(item, depth + 1));
  }

  if (Object.keys(obj).length > MAX_KEYS) {
    throw new Error('Max keys reached');
  }

  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => {
      const originalKey = reversedMap[key] ?? key;
      const originalValue = unminifyConfig(value, depth + 1);
      return [originalKey, originalValue];
    })
  );
}

const reverseConfigMap = (): Record<string, any> => {
  return Object.fromEntries(
    Object.entries(compressedConfigMap).map(([key, value]) => [value, key])
  );
};
