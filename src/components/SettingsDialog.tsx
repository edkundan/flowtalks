
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Badge } from "./ui/badge";
import { X } from "lucide-react";
import { Button } from "./ui/button";
import { useState, useEffect } from "react";
import { toast } from "./ui/use-toast";

export const SettingsDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const [interests, setInterests] = useState<string[]>([]);
  const [newInterest, setNewInterest] = useState("");
  const [college, setCollege] = useState("");
  const [genderPreference, setGenderPreference] = useState("any");
  const [savedSettings, setSavedSettings] = useState(false);

  // Load saved settings when component mounts
  useEffect(() => {
    if (open) {
      const savedInterests = localStorage.getItem('userInterests');
      const savedCollege = localStorage.getItem('userCollege');
      const savedGenderPref = localStorage.getItem('genderPreference');
      
      if (savedInterests) setInterests(JSON.parse(savedInterests));
      if (savedCollege) setCollege(savedCollege);
      if (savedGenderPref) setGenderPreference(savedGenderPref);
    }
  }, [open]);

  const addInterest = () => {
    if (newInterest && !interests.includes(newInterest)) {
      const updatedInterests = [...interests, newInterest];
      setInterests(updatedInterests);
      localStorage.setItem('userInterests', JSON.stringify(updatedInterests));
      setNewInterest("");
    }
  };

  const removeInterest = (interest: string) => {
    const updatedInterests = interests.filter((i) => i !== interest);
    setInterests(updatedInterests);
    localStorage.setItem('userInterests', JSON.stringify(updatedInterests));
  };

  const handleCollegeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCollege(e.target.value);
    localStorage.setItem('userCollege', e.target.value);
  };

  const handleGenderPreferenceChange = (value: string) => {
    setGenderPreference(value);
    localStorage.setItem('genderPreference', value);
  };

  const saveSettings = () => {
    localStorage.setItem('userInterests', JSON.stringify(interests));
    localStorage.setItem('userCollege', college);
    localStorage.setItem('genderPreference', genderPreference);
    
    setSavedSettings(true);
    toast({
      title: "Settings Saved",
      description: "Your preferences have been updated successfully."
    });
    
    setTimeout(() => setSavedSettings(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>College</Label>
            <Input 
              placeholder="Enter your college name" 
              value={college} 
              onChange={handleCollegeChange}
            />
          </div>
          <div className="space-y-2">
            <Label>Interests</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Add interest..."
                value={newInterest}
                onChange={(e) => setNewInterest(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addInterest();
                  }
                }}
              />
              <Button type="button" onClick={addInterest}>
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {interests.map((interest) => (
                <Badge key={interest} variant="secondary" className="gap-1">
                  {interest}
                  <button
                    onClick={() => removeInterest(interest)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Gender Preference</Label>
            <Select 
              value={genderPreference} 
              onValueChange={handleGenderPreferenceChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select gender preference" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={saveSettings} 
            className="mt-4"
            disabled={savedSettings}
          >
            {savedSettings ? "✓ Saved" : "Save Settings"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
