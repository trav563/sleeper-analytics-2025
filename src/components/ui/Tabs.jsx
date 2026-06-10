import * as React from "react"

const TabsContext = React.createContext({});

const Tabs = ({ defaultValue, className, children }) => {
    const [activeTab, setActiveTab] = React.useState(defaultValue);
    return (
        <TabsContext.Provider value={{ activeTab, setActiveTab }}>
            <div className={className}>{children}</div>
        </TabsContext.Provider>
    );
};

const TabsList = ({ className, children }) => (
    <div className={`inline-flex h-10 items-center justify-center rounded-md p-1 text-muted-foreground ${className}`}>
        {children}
    </div>
);

const TabsTrigger = ({ value, className, children }) => {
    const { activeTab, setActiveTab } = React.useContext(TabsContext);
    const isActive = activeTab === value;

    return (
        <button
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 
      ${isActive ? 'bg-background text-foreground shadow-sm' : 'hover:bg-slate-700/50 hover:text-slate-100'} ${className}`}
            onClick={() => setActiveTab(value)}
        >
            {children}
        </button>
    );
};

const TabsContent = ({ value, className, children }) => {
    const { activeTab } = React.useContext(TabsContext);
    if (activeTab !== value) return null;
    return <div className={`ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className}`}>{children}</div>;
};

export { Tabs, TabsList, TabsTrigger, TabsContent };
