import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface PasswordSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPasswordSet: (password: string) => void;
  currentPassword?: string;
}

const PasswordSetupModal = ({ isOpen, onClose, onPasswordSet, currentPassword }: PasswordSetupModalProps) => {
  const [password, setPassword] = useState(currentPassword || "");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSave = () => {
    if (!password) {
      toast.error("Password cannot be empty");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    // Note: In production, you would need to set this environment variable on the server
    // For now, we'll show instructions to the user
    toast.success("Password validation successful! Please set VITE_UPLOAD_PASSWORD in your .env file");
    onPasswordSet(password);
    onClose();
  };

  const handleClose = () => {
    setPassword(currentPassword || "");
    setConfirmPassword("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Lock className="w-5 h-5 text-gallery-accent" />
            {currentPassword ? "Change Upload Password" : "Set Upload Password"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-gallery-accent/5 border border-gallery-accent/20 rounded-lg p-4">
            <p className="text-sm text-muted-foreground">
              Set a password to protect upload functionality. Only users with this password will be able to upload new media to your gallery.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="password" className="text-sm font-medium">
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password (min. 6 characters)"
                  className="bg-background/50 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Eye className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="bg-background/50 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Eye className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-gradient-primary hover:opacity-90 transition-opacity"
            >
              {currentPassword ? "Update Password" : "Set Password"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PasswordSetupModal;