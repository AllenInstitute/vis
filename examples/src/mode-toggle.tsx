import { Box, ToggleButtonGroup, ToggleButton } from '@mui/material';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { spacing } from './constants';
import { useContext } from 'react';
import { ModeContext } from './layout';

export function ModeToggle() {
    const { mode, setMode } = useContext(ModeContext);

    const handleModeChange = (_e: React.MouseEvent<HTMLElement>, mode: 'light' | 'dark') => {
        setMode(mode);
    };

    return (
        <Box
            style={{
                position: 'fixed',
                right: 0,
                padding: spacing.m,
                top: 0,
            }}
        >
            <ToggleButtonGroup exclusive onChange={handleModeChange} value={mode}>
                <ToggleButton value="light" style={{ padding: spacing.s }}>
                    <LightModeIcon />
                </ToggleButton>
                <ToggleButton value="dark" style={{ padding: spacing.s }}>
                    <DarkModeIcon />
                </ToggleButton>
            </ToggleButtonGroup>
        </Box>
    );
}
