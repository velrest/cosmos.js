// Read-only live views. Every access asks peek() for the current data.

const copyOf = (value) => (typeof value === "object" && value !== null ? structuredClone(value) : value);

export function conjureMirage(peek, shape = "object") {
  const isArrayShape = shape === "array";
  const gaze = () => {
    const current = peek();
    return Array.isArray(current) === isArrayShape && current ? current : isArrayShape ? [] : {};
  };

  return new Proxy(isArrayShape ? [] : {}, {
    get(target, key, receiver) {
      if (typeof key !== "symbol") {
        const current = gaze();
        if (Object.hasOwn(current, key)) return copyOf(current[key]);
      }
      return Reflect.get(target, key, receiver);
    },
    has(target, key) {
      return (typeof key !== "symbol" && Object.hasOwn(gaze(), key)) || Reflect.has(target, key);
    },
    ownKeys() {
      return Reflect.ownKeys(gaze());
    },
    getOwnPropertyDescriptor(_target, key) {
      const current = gaze();
      if (!Object.hasOwn(current, key)) return undefined;
      if (isArrayShape && key === "length") {
        return { value: current.length, writable: true, enumerable: false, configurable: false };
      }
      return { value: copyOf(current[key]), writable: true, enumerable: true, configurable: true };
    },
    set: () => true,
    deleteProperty: () => true,
    // Reporting a non-configurable property that isn't really there would break the Proxy.
    defineProperty: (_target, _key, descriptor) => descriptor.configurable !== false,
    setPrototypeOf: () => true,
    // A non-extensible target could never change its keys again, so this always refuses.
    preventExtensions: () => false,
  });
}
