import { Stack, Typography, useTheme } from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import HomeIcon from '@mui/icons-material/Home';
import LaunchIcon from '@mui/icons-material/Launch';
import { useLocation } from 'react-router';
import { colors, pages, spacing } from '~/constants';

export function Sidebar() {
    const loc = useLocation();
    const theme = useTheme();

    return (
        <Stack
            direction="column"
            style={{
                width: '15%',
                height: '100%',
                overflowY: 'auto',
                overflowX: 'hidden',
                paddingLeft: spacing.m,
                paddingRight: spacing.m,
                borderRight: '1px solid',
                borderColor: colors.border,
                minWidth: 130,
            }}
            spacing={spacing.xs}
        >
            <Stack direction="row" spacing={spacing.xs} style={{ paddingTop: spacing.s, justifyContent: 'center' }}>
                <a href="/">
                    <HomeIcon
                        style={{
                            color: loc.pathname === '/' ? theme.palette.text.secondary : theme.palette.text.primary,
                        }}
                    />
                </a>
                <a target="_blank" href="https://www.github.com/AllenInstitute/vis" rel="noreferrer">
                    <GitHubIcon style={{ color: theme.palette.text.primary }} />
                </a>
            </Stack>
            <Stack spacing={spacing.xxs}>
                <Typography style={{ textDecoration: 'underline' }}>Examples</Typography>
                {pages.map(({ name, url, external }) => {
                    return (
                        <a
                            key={name}
                            href={url}
                            target={external ? '_blank' : undefined}
                            style={{
                                display: 'flex',
                                overflow: 'hidden',
                                textWrap: 'nowrap',
                                textOverflow: 'ellipsis',
                                paddingLeft: spacing.m,
                                color: loc.pathname.includes(url)
                                    ? theme.palette.text.secondary
                                    : theme.palette.text.primary,
                                textDecoration: 'none',
                                alignItems: 'center',
                            }}
                        >
                            {name}
                            {external ? <LaunchIcon fontSize="small" /> : null}
                        </a>
                    );
                })}
            </Stack>
        </Stack>
    );
}
