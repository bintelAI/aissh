declare function describe(name: string, callback: () => void): void;
declare function it(name: string, callback: () => void): void;
declare function expect<T>(value: T): {
  toBe(expected: T): void;
};
