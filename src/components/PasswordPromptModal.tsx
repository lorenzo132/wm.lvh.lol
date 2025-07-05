import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff, Shield } from "lucide-react";
import { toast } from "sonner";

interface PasswordPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onPasswordCorrect: (password: string) => void;
}

const PasswordPromptModal = ({ isOpen, onClose, onSuccess, onPasswordCorrect }: PasswordPromptModalProps) => {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const handleSubmit = () => {
    const envPassword = import.meta.env.VITE_UPLOAD_PASSWORD;
    
    if (!envPassword) {
      toast.error("No upload password has been configured");
      onClose();
      return;
    }

    if (password === envPassword) {
      onPasswordCorrect(password);
      onSuccess();
      setPassword("");
      setAttempts(0);
      toast.success("Access granted!");
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      toast.error(`Incorrect password. ${3 - newAttempts} attempts remaining.`);
      
      if (newAttempts >= 3) {
        toast.error("Too many failed attempts. Please try again later.");
        setTimeout(() => {
          setAttempts(0);
          onClose();
        }, 2000);
      }
      setPassword("");
    }
  };

  const handleClose = () => {
    setPassword("");
    setAttempts(0);
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-gallery-accent" />
            Upload Access Required
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-gallery-accent/5 border border-gallery-accent/20 rounded-lg p-4 text-center">
            <Lock className="w-8 h-8 text-gallery-accent mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              This gallery's upload functionality is password protected. Please enter the password to continue.
            </p>
          </div>

          {attempts > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p className="text-sm text-destructive">
                Incorrect password. {3 - attempts} attempts remaining.
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="uploadPassword" className="text-sm font-medium">
              Upload Password
            </Label>
            <div className="relative">
              <Input
                id="uploadPassword"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter upload password"
                className="bg-background/50 pr-10"
                disabled={attempts >= 3}
                autoFocus
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={attempts >= 3}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Eye className="w-4 h-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!password || attempts >= 3}
              className="bg-gradient-primary hover:opacity-90 transition-opacity"
            >
              {attempts >= 3 ? "Too Many Attempts" : "Unlock Upload"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PasswordPromptModal;