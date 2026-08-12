import { describe, expect, it } from "vitest";
import { formValue } from "./form-data";

describe("formValue", () => {
  it("returns the string value for a present field", () => {
    const formData = new FormData();
    formData.set("name", "Rehearsal Room B");
    expect(formValue(formData, "name")).toBe("Rehearsal Room B");
  });

  it("returns an empty string for a missing field", () => {
    const formData = new FormData();
    expect(formValue(formData, "missing")).toBe("");
  });

  it("returns an empty string when the field is a File, not a string", () => {
    const formData = new FormData();
    formData.set("file", new File(["contents"], "test.txt"));
    expect(formValue(formData, "file")).toBe("");
  });

  it("returns an empty string for an explicitly empty field", () => {
    const formData = new FormData();
    formData.set("notes", "");
    expect(formValue(formData, "notes")).toBe("");
  });
});
