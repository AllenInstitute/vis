import { Box, CssBaseline, Stack, StyledEngineProvider, ThemeProvider, useMediaQuery } from '@mui/material';
import { Sidebar } from './common/sidebar';
import { Outlet } from 'react-router';
import { darkTheme, lightTheme } from './theme';
import { createContext, useState } from 'react';
import { ModeToggle } from './mode-toggle';

type modeProviderType = {
    mode: 'light' | 'dark';
    setMode: (mode: 'light' | 'dark') => void;
};
export const ModeContext = createContext<modeProviderType>({
    mode: 'dark',
    setMode: () => {},
});

function ModeProvider(props: React.PropsWithChildren) {
    const darkMode = useMediaQuery('(prefers-color-scheme: dark)');
    const [mode, setMode] = useState<'dark' | 'light'>(darkMode ? 'dark' : 'light');
    return (
        <ModeContext.Provider value={{ mode, setMode }}>
            <ThemeProvider theme={mode === 'dark' ? darkTheme : lightTheme}>{props.children}</ThemeProvider>
        </ModeContext.Provider>
    );
}

export function Layout() {
    return (
        <StyledEngineProvider>
            <ModeProvider>
                <CssBaseline />
                <Stack
                    style={{
                        width: '100vw',
                        height: '100vh',
                        overflow: 'hidden',
                    }}
                    direction="row"
                >
                    <Sidebar />
                    <Box style={{ overflow: 'auto' }}>
                        <Outlet />
                    </Box>
                </Stack>
                <ModeToggle />
            </ModeProvider>
        </StyledEngineProvider>
    );
}
