import { Mail } from "@/components/mail/mail";
import { accounts, mails } from "@/data";
import "./index.css";

export function App() {
  return (
    <div className="h-screen w-screen">
      <Mail
        accounts={accounts}
        defaultCollapsed={false}
        defaultLayout={[20, 32, 48]}
        mails={mails}
        navCollapsedSize={4}
      />
    </div>
  );
}

export default App;
