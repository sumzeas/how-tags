import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/users/password";
import { SignUpForm } from "./SignUpForm";

export default function SignUpPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Create an account</h1>
      <SignUpForm passwordMin={PASSWORD_MIN_LENGTH} passwordMax={PASSWORD_MAX_LENGTH} />
    </main>
  );
}
