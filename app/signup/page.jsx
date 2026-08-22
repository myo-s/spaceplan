import Account from "../../components/Account";

export const metadata = {
  title: "Sign up — Space Plan",
  description: "Make an account so your plan follows you between machines.",
};

export default function SignupPage() {
  return <Account mode="signup" />;
}
