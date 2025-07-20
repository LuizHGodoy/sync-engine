describe("Jest Configuration", () => {
  it("should be properly configured", () => {
    expect(true).toBe(true);
  });
});

describe("TypeScript Configuration", () => {
  it("should compile TypeScript files", () => {
    const message: string = "TypeScript is working";
    expect(message).toBe("TypeScript is working");
  });
});
