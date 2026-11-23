import React from "react";
interface SettingsSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    isLocal: boolean;
    onModeChange: (local: boolean) => void;
    apiKey: string;
    setApiKey: (key: string) => void;
    model: string;
    setModel: (model: string) => void;
    themeKey: string;
    onThemeChange: (theme: string) => void;
    customAccent: string;
    setCustomAccent: (color: string) => void;
    fontFamily: string;
    setFontFamily: (font: string) => void;
    onClearChat: () => void;
}
export declare const SettingsSidebar: React.FC<SettingsSidebarProps>;
export {};
//# sourceMappingURL=SettingsSidebar.d.ts.map