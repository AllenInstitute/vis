import {
    Box,
    Stack,
    Table,
    TableCell,
    TableHead,
    TableRow,
    Typography,
    useTheme,
} from "@mui/material";
import { spacing } from "./constants";
import { Link } from "@czi-sds/components";

export function Home() {
    const theme = useTheme();
    const linkStyle = {
        textDecoration: "underline",
        color: theme.palette.text.secondary,
    };
    return (
        <Box width="100%" height="100%">
            <Stack spacing={spacing.s} style={{ padding: spacing.l }}>
                <Stack spacing={spacing.xs}>
                    <Typography
                        variant="h3"
                        style={{ textDecoration: "underline" }}
                    >
                        Allen Institute Vis Library
                    </Typography>
                    <Typography>
                        This library contains a collection of TypeScript
                        libraries to help software engineers building scalable
                        visualization tools at the Allen Institute.
                    </Typography>
                    <Typography>
                        The examples on this site are intended to show the
                        capabilities of the published packages that can be found
                        on our{" "}
                        <Link
                            target="_blank"
                            href="https://www.github.com/alleninstitute/vis"
                            style={linkStyle}
                        >
                            Github repo
                        </Link>
                        .
                    </Typography>
                    <Typography>
                        The packages should be considered in alpha or beta
                        states. While they are used in a production environment
                        for{" "}
                        <Link
                            target="_blank"
                            href="https://knowledge.brain-map.org/"
                            style={linkStyle}
                        >
                            The Brain Knowledge Platform
                        </Link>
                        , they may fundamentally change as we continue to build
                        out functionality.
                    </Typography>
                </Stack>

                <Stack spacing={spacing.xxs}>
                    <Typography
                        variant="h4"
                        style={{ textDecoration: "underline" }}
                    >
                        Packages
                    </Typography>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell style={{ minWidth: 120 }}>
                                    Name
                                </TableCell>
                                <TableCell>Description</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableRow>
                            <TableCell>vis-core</TableCell>
                            <TableCell>
                                Utilities used to build our big-data friendly,
                                scalable, data visualization tools
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell>vis-dzi</TableCell>
                            <TableCell>
                                Renderer for{" "}
                                <Link
                                    target="_blank"
                                    href="https://en.wikipedia.org/wiki/Deep_Zoom"
                                    style={linkStyle}
                                >
                                    Deep Zoom Images
                                </Link>
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell>vis-omezarr</TableCell>
                            <TableCell>
                                Renderer for{" "}
                                <Link
                                    target="_blank"
                                    href="https://ngff.openmicroscopy.org/latest/"
                                    style={linkStyle}
                                >
                                    OME-Zarr
                                </Link>{" "}
                                datasets
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell>vis-geometry</TableCell>
                            <TableCell>
                                Vector functions for 2D and 3D geometry
                            </TableCell>
                        </TableRow>
                    </Table>
                </Stack>
            </Stack>
        </Box>
    );
}
