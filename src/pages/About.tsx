import { Header } from "@/components/Header";

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-6 text-primary">About RandomChat</h1>
        
        <div className="space-y-6 text-foreground">
          <section className="glass p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Our Mission</h2>
            <p className="text-lg">
              RandomChat connects people from around the world through instant messaging and voice calls. 
              Our platform provides a safe and engaging environment for meeting new people and having 
              meaningful conversations.
            </p>
          </section>

          <section className="glass p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Community Guidelines</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Be respectful to all users</li>
              <li>No harassment or hate speech</li>
              <li>Protect your privacy - don't share personal information</li>
              <li>Report inappropriate behavior</li>
              <li>Users must be 18 or older</li>
            </ul>
          </section>

          <section className="glass p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Features</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Random text chat matching</li>
              <li>Voice calls with strangers</li>
              <li>Interest-based matching</li>
              <li>Dark/Light mode support</li>
              <li>User safety controls</li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
};

export default About;