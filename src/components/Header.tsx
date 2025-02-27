
import { History, Info, Mail, Settings } from "lucide-react";
import { Button } from "./ui/button";
import { ThemeToggle } from "./theme-toggle";
import { Link, useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useSettings } from "@/hooks/use-settings";

export const Header = () => {
  const { openSettings } = useSettings();
  const navigate = useNavigate();

  return (
    <header className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Link to="/" className="text-xl font-semibold text-primary">
        FlowTalks
      </Link>
      
      <div className="flex items-center gap-6">
        <nav className="hidden md:flex items-center gap-6">
          <Button 
            variant="ghost" 
            className="flex flex-col items-center gap-1"
            onClick={() => navigate('/about')}
          >
            <Info className="h-4 w-4" />
            <span className="text-xs">About Us</span>
          </Button>
          <Button 
            variant="ghost" 
            className="flex flex-col items-center gap-1"
            onClick={() => navigate('/contact')}
          >
            <Mail className="h-4 w-4" />
            <span className="text-xs">Contact Us</span>
          </Button>
          <Button variant="ghost" className="flex flex-col items-center gap-1">
            <History className="h-4 w-4" />
            <span className="text-xs">History</span>
          </Button>
        </nav>

        {/* Mobile Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <span className="sr-only">Open menu</span>
              <svg
                width="15"
                height="15"
                viewBox="0 0 15 15"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
              >
                <path
                  d="M1.5 3C1.22386 3 1 3.22386 1 3.5C1 3.77614 1.22386 4 1.5 4H13.5C13.7761 4 14 3.77614 14 3.5C14 3.22386 13.7761 3 13.5 3H1.5ZM1 7.5C1 7.22386 1.22386 7 1.5 7H13.5C13.7761 7 14 7.22386 14 7.5C14 7.77614 13.7761 8 13.5 8H1.5C1.22386 8 1 7.77614 1 7.5ZM1 11.5C1 11.2239 1.22386 11 1.5 11H13.5C13.7761 11 14 11.2239 14 11.5C14 11.7761 13.7761 12 13.5 12H1.5C1.22386 12 1 11.7761 1 11.5Z"
                  fill="currentColor"
                  fillRule="evenodd"
                  clipRule="evenodd"
                ></path>
              </svg>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate('/about')}>
              <Info className="h-4 w-4 mr-2" />
              About Us
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/contact')}>
              <Mail className="h-4 w-4 mr-2" />
              Contact Us
            </DropdownMenuItem>
            <DropdownMenuItem>
              <History className="h-4 w-4 mr-2" />
              History
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ThemeToggle />
        
        <Button
          variant="ghost"
          size="icon"
          className="ml-2"
          onClick={() => openSettings()}
        >
          <Settings className="h-5 w-5" />
          <span className="sr-only">Settings</span>
        </Button>
      </div>
    </header>
  );
};
