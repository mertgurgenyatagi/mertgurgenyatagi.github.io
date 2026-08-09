import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { auth } from "../firebase";

export function LogoutButton({
  size = "sm",
  variant = "outline",
}: {
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "ghost" | "secondary";
}) {
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut(auth);
    navigate("/");
  }

  return (
    <Button variant={variant} size={size} onClick={() => void handleLogout()}>
      Sign out
    </Button>
  );
}
