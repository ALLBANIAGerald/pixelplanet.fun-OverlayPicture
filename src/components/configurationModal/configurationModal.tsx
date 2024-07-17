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
import { isAutoSelectColorActiveSignal, isOverlayEnabledSignal, overlayTransparencySignal, showBigModal } from '../../store/slices/overlaySlice';
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
            <OverlayThumbnailImageButton
                onclick={() => {
                    showBigModal.set(!showBigModal.get());
                }}
                class="tw-size-9"
            />
        </div>
    );
}

export function ConfigurationModal() {
    const isBigModal = useSignal(showBigModal);
    return (
        <Show when={isBigModal()} fallback={<SmallModal />}>
            <BigModal />
        </Show>
    );
}

const BigModal = () => {
    const isOverlayEnabled = useSignal(isOverlayEnabledSignal);
    const transparency = useSignal(overlayTransparencySignal);
    const autoSelectColor = useSignal(isAutoSelectColorActiveSignal);
    return (
        <>
            <div>
                <div class="tw-modal-box tw-absolute tw-right-2 tw-top-2 tw-flex tw-min-h-20 tw-w-fit tw-min-w-12 tw-scale-100 tw-flex-col tw-justify-items-center tw-overflow-y-hidden tw-overscroll-contain tw-p-2">
                    <div class="tw-flex tw-flex-row">
                        <input
                            type="checkbox"
                            class="tw-toggle tw-toggle-success"
                            onchange={(e) => {
                                isOverlayEnabledSignal[1](e.target.checked);
                            }}
                            checked={isOverlayEnabled()}
                        />
                        <div class="tw-flex tw-flex-1 tw-items-center tw-justify-center">
                            <h3 class="text-lg font-bold tw-m-0">Picture Overlay</h3>
                        </div>
                        <OverlayThumbnailImageButton
                            onclick={() => {
                                showBigModal.set(!showBigModal.get());
                            }}
                            class="tw-size-9"
                        />
                    </div>
                    <div class="tw-flex tw-flex-col">
                        <div class="tw-form-control">
                            <label class="tw-label tw-cursor-pointer">
                                <span class="tw-label-text">Auto select color</span>
                                <input
                                    type="checkbox"
                                    class="tw-toggle tw-toggle-info"
                                    checked={autoSelectColor()}
                                    onchange={(e) => {
                                        isAutoSelectColorActiveSignal.set(e.target.checked);
                                    }}
                                />
                            </label>
                        </div>
                        <div class="tw-form-control">
                            <label class="tw-label tw-cursor-pointer tw-gap-1">
                                <span class="tw-label-text">Transparency</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={transparency()}
                                    onchange={(e) => {
                                        overlayTransparencySignal.set(e.target.valueAsNumber);
                                    }}
                                    class="tw-range"
                                />
                            </label>
                        </div>
                    </div>
                    <div class="tw-divider" />
                    <div class="tw-flex tw-flex-col">
                        <div class="tw-flex tw-flex-row tw-gap-1">
                            <div class="tw-avatar">
                                <div class="tw-w-24 tw-rounded-xl">
                                    <img src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" />
                                </div>
                            </div>
                            <div class="tw-flex tw-flex-row tw-gap-1">
                                <button class="tw-btn tw-btn-square tw-btn-ghost">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 -960 960 960" fill="currentColor">
                                        <path d="M720-330q0 104-73 177T470-80q-104 0-177-73t-73-177v-370q0-75 52.5-127.5T400-880q75 0 127.5 52.5T580-700v350q0 46-32 78t-78 32q-46 0-78-32t-32-78v-370h80v370q0 13 8.5 21.5T470-320q13 0 21.5-8.5T500-350v-350q-1-42-29.5-71T400-800q-42 0-71 29t-29 71v370q-1 71 49 120.5T470-160q70 0 119-49.5T640-330v-390h80v390Z" />
                                    </svg>
                                </button>
                                <button class="tw-btn tw-btn-square tw-btn-ghost">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 -960 960 960" fill="currentColor">
                                        <path d="M480-480q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Zm0 294q122-112 181-203.5T720-552q0-109-69.5-178.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186Zm0 106Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 100-79.5 217.5T480-80Zm0-480Z" />
                                    </svg>
                                </button>
                                <button class="tw-btn">Move</button>
                                <label class="w-full max-w-xs tw-form-control">
                                    <div class="tw-label">
                                        <span class="tw-label-text">X</span>
                                    </div>
                                    <input type="number" placeholder="Type here" class="w-full max-w-xs tw-input tw-input-bordered" />
                                </label>
                                <label class="w-full max-w-xs tw-form-control">
                                    <div class="tw-label">
                                        <span class="tw-label-text">Y</span>
                                    </div>
                                    <input type="number" placeholder="Type here" class="w-full max-w-xs tw-input tw-input-bordered" />
                                </label>
                            </div>
                            <div class="tw-flex tw-flex-col">
                                <div class="tw-form-control">
                                    <label class="tw-label tw-cursor-pointer">
                                        <span class="tw-label-text">Convert colors</span>
                                        <input type="checkbox" class="tw-toggle tw-toggle-info" />
                                    </label>
                                </div>
                                <div class="tw-form-control">
                                    <label class="tw-label tw-cursor-pointer tw-gap-1">
                                        <span class="tw-label-text">Image brightness</span>
                                        <input type="range" min="0" max="100" class="tw-range" />
                                    </label>
                                </div>
                            </div>
                        </div>
                        <p class="py-4">Press ESC key or click the button below to close</p>
                        <div class="tw-modal-action">
                            <form method="dialog">
                                <button class="tw-btn">Close</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
            {/* <div class="tw-base tw-absolute tw-right-4 tw-top-4 tw-size-9 tw-border tw-border-solid tw-border-black tw-backdrop-blur">
                <OverlayThumbnailImageButton class="tw-size-9" />
            </div> */}
        </>
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
