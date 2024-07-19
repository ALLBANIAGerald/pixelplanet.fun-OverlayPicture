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
import { createSignal, Show } from 'solid-js';
import { useSignal } from '../../store/useSignal';
import { isAutoSelectColorActiveSignal, isOverlayEnabledSignal, overlayTransparencySignal, showBigModal } from '../../store/slices/overlaySlice';
import { OverlayThumbnailImageButton } from './overlayThumbnailImage';
import Dismiss from 'solid-dismiss';

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
        <div class="tw-base tw-absolute tw-right-4 tw-top-4 tw-flex tw-size-9 tw-items-center tw-justify-center tw-border tw-border-solid tw-border-black tw-backdrop-blur">
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
    const [open, setOpen] = createSignal(false);
    let btnEl;

    return (
        <>
            <div>
                <div class="tw-modal-box tw-absolute tw-right-2 tw-top-2 tw-box-border tw-flex !tw-h-[calc-size(auto)] tw-h-auto tw-max-h-[calc(100%-theme(spacing.2)*2-16px-36px)] tw-min-h-20 !tw-w-[calc-size(fit-content)] tw-w-fit tw-min-w-12 tw-max-w-[calc(100%-theme(spacing.2)*2-98px-36px)] tw-scale-100 tw-flex-col tw-justify-items-center tw-overflow-auto tw-overscroll-contain tw-p-2 tw-transition-[color,background-color,border-color,text-decoration-color,fill,stroke,opacity,box-shadow,transform,filter,backdrop-filter,-webkit-backdrop-filter,height] starting:tw-h-4 starting:tw-w-4 starting:tw-bg-opacity-70">
                    <div class="tw-grid [grid-template-columns:3rem_1fr_3rem]">
                        <input
                            type="checkbox"
                            class="tw-toggle tw-toggle-success"
                            onchange={(e) => {
                                isOverlayEnabledSignal[1](e.target.checked);
                            }}
                            checked={isOverlayEnabled()}
                        />
                        <div class="tw-flex tw-flex-1 tw-items-center tw-justify-center tw-@container">
                            <h3 class="tw-m-0 tw-hidden tw-text-center tw-text-lg tw-font-bold @[9rem]:tw-block">Picture Overlay</h3>
                            <h3 class="tw-m-0 tw-hidden tw-text-center tw-text-lg tw-font-bold @[5rem]:tw-block @[9rem]:tw-hidden">Overlay</h3>
                        </div>
                        <OverlayThumbnailImageButton
                            onclick={() => {
                                showBigModal.set(!showBigModal.get());
                            }}
                            class="tw-size-9 tw-justify-self-end"
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
                                    oninput={(e) => {
                                        overlayTransparencySignal.set(e.target.valueAsNumber);
                                    }}
                                    class="tw-range"
                                />
                            </label>
                        </div>
                    </div>
                    <div class="tw-divider" />
                    <div class="tw-flex tw-flex-col">
                        <div class="tw-flex tw-flex-col tw-gap-1 tw-@container">
                            <div class="tw-grid tw-gap-1 [grid-template-areas:'image_buttons''slider_slider'] [grid-template-columns:6rem_1fr] @[16rem]:[grid-template-areas:'image_buttons''image_slider'] @[16rem]:[grid-template-columns:8rem_1fr]">
                                <div class="tw-avatar tw-self-center [grid-area:image]">
                                    <div class="tw-relative tw-h-24 tw-w-24 tw-rounded-xl @[16rem]:tw-h-32 @[16rem]:tw-w-32">
                                        <input type="checkbox" checked={true} class="tw-checkbox tw-pointer-events-none tw-absolute tw-h-4 tw-w-4" />
                                        <img src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp" />
                                    </div>
                                </div>
                                <div class="tw-flex tw-flex-row tw-flex-wrap tw-self-center [grid-area:buttons]">
                                    <button class="tw-btn tw-btn-square tw-btn-ghost">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="tw-h-6 tw-w-6" viewBox="0 -960 960 960" fill="currentColor">
                                            <path d="M720-330q0 104-73 177T470-80q-104 0-177-73t-73-177v-370q0-75 52.5-127.5T400-880q75 0 127.5 52.5T580-700v350q0 46-32 78t-78 32q-46 0-78-32t-32-78v-370h80v370q0 13 8.5 21.5T470-320q13 0 21.5-8.5T500-350v-350q-1-42-29.5-71T400-800q-42 0-71 29t-29 71v370q-1 71 49 120.5T470-160q70 0 119-49.5T640-330v-390h80v390Z" />
                                        </svg>
                                    </button>
                                    <button class="tw-btn tw-btn-square tw-btn-ghost [grid-area:buttons]">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="tw-h-6 tw-w-6" viewBox="0 -960 960 960" fill="currentColor">
                                            <path d="M480-480q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Zm0 294q122-112 181-203.5T720-552q0-109-69.5-178.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186Zm0 106Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 100-79.5 217.5T480-80Zm0-480Z" />
                                        </svg>
                                    </button>
                                    <button class="tw-btn tw-btn-square tw-btn-ghost [grid-area:buttons]">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="tw-h-6 tw-w-6" viewBox="0 -960 960 960" fill="currentColor">
                                            <path d="M480-80 310-250l57-57 73 73v-206H235l73 72-58 58L80-480l169-169 57 57-72 72h206v-206l-73 73-57-57 170-170 170 170-57 57-73-73v206h205l-73-72 58-58 170 170-170 170-57-57 73-73H520v205l72-73 58 58L480-80Z" />
                                        </svg>
                                    </button>
                                    <button class="tw-btn tw-btn-square tw-btn-ghost [grid-area:buttons]">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="tw-h-6 tw-w-6" viewBox="0 -960 960 960" fill="currentColor">
                                            <path d="m376-300 104-104 104 104 56-56-104-104 104-104-56-56-104 104-104-104-56 56 104 104-104 104 56 56Zm-96 180q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520Zm-400 0v520-520Z" />
                                        </svg>
                                    </button>
                                </div>
                                <label class="tw-form-control tw-w-full tw-max-w-xs [grid-area:slider]">
                                    <div class="tw-label">
                                        <span class="tw-label-text">Coordinates</span>
                                    </div>
                                    <input type="text" placeholder="Type here" class="w-full tw-input tw-input-bordered tw-max-w-xs" />
                                </label>
                                <div ref={btnEl} tabindex="0" role="button" class="tw-tw-btn tw-m-1">
                                    <img class="tw-h-8 tw-w-8" alt="preview" src="/preview0.png"></img>
                                </div>
                                <Dismiss menuButton={btnEl} open={open} setOpen={setOpen}>
                                    <ul tabindex="0" class="tw-menu tw-dropdown-content tw-z-[1] tw-w-fit tw-rounded-box tw-bg-base-200 tw-p-2 tw-shadow">
                                        <li class="tw-flex tw-flex-row tw-flex-nowrap tw-items-center">
                                            <img class="tw-h-8 tw-w-8" alt="preview" src="/preview0.png"></img>
                                            <a>Earth</a>
                                        </li>
                                        <li class="tw-flex tw-flex-row tw-flex-nowrap tw-items-center">
                                            <img class="tw-h-8 tw-w-8" alt="preview" src="/preview11.png"></img>
                                            <a>Minimap</a>
                                        </li>
                                        <li class="tw-flex tw-flex-row tw-flex-nowrap tw-items-center">
                                            <img class="tw-h-8 tw-w-8" alt="preview" src="/preview1.png"></img>
                                            <a>Moon</a>
                                        </li>
                                        <li class="tw-flex tw-flex-row tw-flex-nowrap tw-items-center">
                                            <img class="tw-h-8 tw-w-8" alt="preview" src="/preview3.png"></img>
                                            <a>Coronavirus</a>
                                        </li>
                                    </ul>
                                </Dismiss>
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
                        <div class="tw-flex tw-flex-row">
                            <button class="tw-btn tw-btn-square tw-btn-ghost">
                                <svg xmlns="http://www.w3.org/2000/svg" class="tw-h-6 tw-w-6" viewBox="0 -960 960 960" fill="currentColor">
                                    <path d="M640-520v-200h80v200h-80ZM440-244q-35-10-57.5-39T360-350v-370h80v476Zm30 164q-104 0-177-73t-73-177v-370q0-75 52.5-127.5T400-880q75 0 127.5 52.5T580-700v300h-80v-300q-1-42-29.5-71T400-800q-42 0-71 29t-29 71v370q-1 71 49 120.5T470-160q25 0 47.5-6.5T560-186v89q-21 8-43.5 12.5T470-80Zm170-40v-120H520v-80h120v-120h80v120h120v80H720v120h-80Z" />
                                </svg>
                            </button>
                            <button class="tw-btn tw-btn-square tw-btn-ghost">
                                <svg xmlns="http://www.w3.org/2000/svg" class="tw-h-6 tw-w-6" viewBox="0 -960 960 960" fill="currentColor">
                                    <path d="M680-80q-50 0-85-35t-35-85q0-6 3-28L282-392q-16 15-37 23.5t-45 8.5q-50 0-85-35t-35-85q0-50 35-85t85-35q24 0 45 8.5t37 23.5l281-164q-2-7-2.5-13.5T560-760q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35q-24 0-45-8.5T598-672L317-508q2 7 2.5 13.5t.5 14.5q0 8-.5 14.5T317-452l281 164q16-15 37-23.5t45-8.5q50 0 85 35t35 85q0 50-35 85t-85 35Zm0-80q17 0 28.5-11.5T720-200q0-17-11.5-28.5T680-240q-17 0-28.5 11.5T640-200q0 17 11.5 28.5T680-160ZM200-440q17 0 28.5-11.5T240-480q0-17-11.5-28.5T200-520q-17 0-28.5 11.5T160-480q0 17 11.5 28.5T200-440Zm480-280q17 0 28.5-11.5T720-760q0-17-11.5-28.5T680-800q-17 0-28.5 11.5T640-760q0 17 11.5 28.5T680-720Zm0 520ZM200-480Zm480-280Z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
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
