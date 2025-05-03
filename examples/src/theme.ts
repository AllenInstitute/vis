import { createTheme } from "@mui/material";
import { colors } from "./constants";

export const darkTheme = createTheme({
    palette: {
        mode: "dark",
        background: {
            default: colors.dark.background,
        },
        text: {
            primary: colors.dark.text,
            secondary: colors.dark.textSelected,
        },
    },
});

export const lightTheme = createTheme({
    palette: {
        mode: "light",
    },
    text: {
        primary: colors.light.text,
        secondary: colors.light.textSelected,
    },
});
