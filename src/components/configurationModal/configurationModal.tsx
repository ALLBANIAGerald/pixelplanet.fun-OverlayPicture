// import { setInputImageAction } from '../../actions/imageProcessing';
// import { get as getColor, to as toColor } from 'color-string';
// import React, { useCallback } from 'react';
// import { useDropzone } from 'react-dropzone';
// import { isOverlayEnabledSignal } from '../../store/slices/overlaySlice';
// import { useSignal } from '../../store/useSignal';
// import { createMakeStyles } from 'tss-react';

// import ExpandLess from '@mui/icons-material/ExpandLess';
// import Palette from '@mui/icons-material/Palette';
// import { Checkbox, FormControlLabel, IconButton, Tooltip, useTheme } from '@mui/material';

// import { useAppDispatch } from '../../store/hooks';
// import ConfigDropDown from '../configDropDown/configDropDown';
// import OverlayConfig from '../overlayConfig/overlayConfig';
import { Show } from 'solid-js';
import { useSignal } from '../../store/useSignal';
import { isOverlayEnabledSignal } from '../../store/slices/overlaySlice';
import { OverlayThumbnailImageButton } from './overlayThumbnailImage';

// const makeStyles = createMakeStyles({ useTheme });
// const useStyles = makeStyles.makeStyles<{ isMinimized: boolean }>()((theme, props) => {
//     const { isMinimized } = props;
//     const backgroundColor = getColor.rgb(theme.palette.background.paper);
//     backgroundColor[3] = 0.9;
//     return {
//         modalRoot: {
//             position: 'absolute',
//             right: '0.9em',
//             top: '0.1em',
//             width: isMinimized ? undefined : '15em',
//             border: '1px solid rgb(0, 0, 0)',
//             backgroundColor: toColor.rgb(backgroundColor),
//             padding: '5px',
//             fontSize: '0.9em',
//             overflowY: 'auto',
//             overflowX: 'hidden',
//             maxHeight: 'calc(100vh - 1.5em)',
//         },
//     };
// });

function SmallModal() {
    return (
        <div class="tw-base tw-absolute tw-right-4 tw-top-4 tw-size-9 tw-border tw-border-solid tw-border-black tw-backdrop-blur">
            <OverlayThumbnailImageButton class="tw-size-9" />
        </div>
    );
}

export function ConfigurationModal() {
    return (
        <Show when={true} fallback={<SmallModal />}>
            <BigModal />
        </Show>
    );
}

const BigModal = () => {
    return (
        <div class="tw-base tw-absolute tw-right-4 tw-top-4 tw-size-9 tw-border tw-border-solid tw-border-black tw-backdrop-blur">
            <OverlayThumbnailImageButton class="tw-size-9" />
        </div>
    );
};

// const ConfigurationModal = () => {
//     const [isModalMinimized, setIsModalMinimized] = React.useState(false);
//     const { classes } = useStyles({ isMinimized: isModalMinimized });
//     const dispatch = useAppDispatch();

//     const isOverlayEnabled = useSignal(isOverlayEnabledSignal);
//     const onDrop = useCallback(
//         (acceptedFiles: File[]) => {
//             const file = acceptedFiles[0];
//             if (file) dispatch(setInputImageAction(file));
//         },
//         [dispatch]
//     );
//     const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': ['.png', '.gif', '.jpeg', '.jpg'] }, noClick: true });

//     const handleToggleOverlayOnOff = (e: React.ChangeEvent<HTMLInputElement>) => {
//         isOverlayEnabledSignal[1](e.target.checked);
//     };
//     return (
//         <div {...getRootProps()} className={classes.modalRoot} style={{ border: isDragActive ? '3px dashed red' : undefined }}>
//             {!isModalMinimized && (
//                 <>
//                     <input {...getInputProps()} hidden />
//                     <Tooltip title="Toggle on/off Overlay. Shortcut: O">
//                         <FormControlLabel control={<Checkbox color="primary" checked={isOverlayEnabled} onChange={handleToggleOverlayOnOff} />} label="Image Overlay" labelPlacement="end" />
//                     </Tooltip>
//                     <div
//                         style={{
//                             display: isOverlayEnabled ? '' : 'none',
//                         }}
//                     >
//                         <div
//                             style={{
//                                 display: isModalMinimized ? 'none' : '',
//                             }}
//                         >
//                             <div>
//                                 <OverlayConfig />
//                             </div>

//                             <ConfigDropDown />
//                         </div>
//                     </div>
//                 </>
//             )}
//             <IconButton
//                 onClick={(): void => {
//                     setIsModalMinimized(!isModalMinimized);
//                 }}
//             >
//                 {isModalMinimized ? <Palette /> : <ExpandLess />}
//             </IconButton>
//         </div>
//     );
// };
