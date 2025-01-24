import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

export const DisclaimerDialog = ({
  open,
  onAccept,
}: {
  open: boolean;
  onAccept: () => void;
}) => {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Welcome to RandomChat</AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>
              Before you continue, please read and accept our guidelines:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Be respectful to all users</li>
              <li>No harassment or hate speech</li>
              <li>No explicit or inappropriate content</li>
              <li>Protect your privacy - don't share personal information</li>
              <li>Users must be 18 years or older</li>
            </ul>
            <p className="font-medium">
              By clicking Accept, you agree to follow these guidelines and our terms of service.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onAccept}>Accept & Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};