import Account from "../../components/Account";

export const metadata = {
  title: "Log in — Space Plan",
  description: "Open the plans you have saved.",
};

export default function LoginPage() {
  return <Account mode="login" />;
}
