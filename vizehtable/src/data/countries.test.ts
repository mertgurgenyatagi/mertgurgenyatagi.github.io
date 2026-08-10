import { describe, expect, it } from "vitest";
import { COUNTRIES, countryName, isCountryCode, searchCountries } from "./countries";

describe("the country list", () => {
  it("is substantial enough to cover a general audience", () => {
    expect(COUNTRIES.length).toBeGreaterThan(180);
  });

  it("has no duplicate codes or names", () => {
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
    expect(new Set(COUNTRIES.map((c) => c.name)).size).toBe(COUNTRIES.length);
  });

  it("uses two-letter ISO codes", () => {
    for (const country of COUNTRIES) {
      expect(country.code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("is alphabetical, so the picker needs no re-sort at render time", () => {
    const names = COUNTRIES.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("includes the ones this audience will actually reach for", () => {
    const codes = new Set(COUNTRIES.map((c) => c.code));
    for (const code of ["IE", "GB", "US", "TR", "AU", "IN", "NG"]) {
      expect(codes.has(code), `missing ${code}`).toBe(true);
    }
  });
});

describe("searchCountries", () => {
  it("returns everything for an empty query", () => {
    expect(searchCountries("   ").length).toBe(COUNTRIES.length);
  });

  it("matches case-insensitively on a substring", () => {
    expect(searchCountries("IRE").some((c) => c.code === "IE")).toBe(true);
  });

  it("matches through accents — 'turkiye' finds Türkiye", () => {
    expect(searchCountries("turkiye").some((c) => c.code === "TR")).toBe(true);
  });

  it("matches 'cote' against Côte d'Ivoire", () => {
    expect(searchCountries("cote").some((c) => c.code === "CI")).toBe(true);
  });

  it("returns nothing for gibberish", () => {
    expect(searchCountries("zzzzqqq")).toEqual([]);
  });
});

describe("country lookups", () => {
  it("resolves a known code", () => {
    expect(countryName("IE")).toBe("Ireland");
    expect(isCountryCode("IE")).toBe(true);
  });

  it("falls back to the raw code for anything unknown", () => {
    expect(countryName("ZZ")).toBe("ZZ");
    expect(isCountryCode("ZZ")).toBe(false);
  });
});
