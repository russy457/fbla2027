/**
 * AddressFields.tsx
 * Street, city, state, ZIP inputs shared by the organization profile and
 * opportunity forms (SPEC 3.2 address {line1, city, state, zip}). `errorPrefix`
 * maps zod issue paths ("address.zip", "location.address.zip") to fields.
 */
import type { ReactElement } from "react";
import type { Address } from "@fbla/shared";
import { TextField } from "@/components/ui/TextField";
import type { FieldErrors } from "@/lib/validation/fieldErrors";

export const EMPTY_ADDRESS: Address = { line1: "", city: "", state: "TX", zip: "" };

interface AddressFieldsProps {
  readonly value: Address;
  readonly onChange: (next: Address) => void;
  readonly errors: FieldErrors;
  readonly errorPrefix: string;
  readonly disabled?: boolean;
}

export const AddressFields = ({ value, onChange, errors, errorPrefix, disabled = false }: AddressFieldsProps): ReactElement => {
  const set = (key: keyof Address, next: string): void => onChange({ ...value, [key]: key === "state" ? next.toUpperCase() : next });
  const err = (key: keyof Address): string | undefined => errors[`${errorPrefix}.${key}`];
  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="mb-1 text-sm font-semibold text-fg">Address</legend>
      <TextField label="Street address" value={value.line1} onChange={(event) => set("line1", event.target.value)} error={err("line1")} autoComplete="address-line1" />
      <div className="grid gap-3 sm:grid-cols-[1fr_6rem_8rem]">
        <TextField label="City" value={value.city} onChange={(event) => set("city", event.target.value)} error={err("city")} autoComplete="address-level2" />
        <TextField label="State" value={value.state} maxLength={2} onChange={(event) => set("state", event.target.value)} error={err("state")} autoComplete="address-level1" />
        <TextField label="ZIP" value={value.zip} inputMode="numeric" maxLength={5} onChange={(event) => set("zip", event.target.value)} error={err("zip")} autoComplete="postal-code" />
      </div>
    </fieldset>
  );
};
