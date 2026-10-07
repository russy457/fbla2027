/**
 * VerifyCodeForm.tsx
 * The "Verify a letter" code box (SPEC#letters: "/verify has a code entry
 * box"). Accepts the printed form with dashes or spaces and any letter case;
 * zod normalizes and checks the 26-character base32 shape before navigating
 * to /verify/<code>.
 */
import type { ReactElement } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { TextField } from "@/components/ui/TextField";
import { verifyCodeFormSchema } from "@/lib/validation/formSchemas";

interface VerifyCodeFormProps {
  readonly defaultCode?: string;
  readonly label?: string;
}

export const VerifyCodeForm = ({ defaultCode = "", label = "Letter code" }: VerifyCodeFormProps): ReactElement => {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<{ code: string }, unknown, { code: string }>({
    resolver: zodResolver(verifyCodeFormSchema),
    defaultValues: { code: defaultCode }
  });

  const submit = handleSubmit((values) => navigate(`/verify/${values.code}`));

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:items-end">
      <TextField
        label={label}
        hint="It's printed on the letter, like ABCD-EFGH-..."
        autoComplete="off"
        spellCheck={false}
        autoCapitalize="characters"
        error={errors.code?.message}
        className="flex-1"
        inputClassName="font-mono uppercase"
        {...register("code")}
      />
      <button type="submit" className={buttonClassName("primary")}>
        Verify
      </button>
    </form>
  );
};
