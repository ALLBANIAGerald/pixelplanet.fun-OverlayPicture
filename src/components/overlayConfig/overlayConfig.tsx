import React, { useEffect } from 'react';

import WarningIcon from '@mui/icons-material/Warning';
import { Button, Checkbox, FormControlLabel, Input, Slider, TextField, Tooltip, Typography } from '@mui/material';
import { Box } from '@mui/material/node_modules/@mui/system';

import { clearInputImageAction, setInputImageAction } from '../../actions/imageProcessing';
import viewport from '../../gameInjection/viewport';
import { useDebounce } from '../../hooks/debounce';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectHoverPixel } from '../../store/slices/gameSlice';
import {
    overlaySlice,
    selectInputImageLoadingStatus,
    selectInputUrl,
    selectIsModificationsAvailable,
    selectIsOutputImageProcessing,
    selectModifierImageBrightness,
    selectModifierShouldConvertColors,
    selectPlacementAutoSelectColor,
    selectPlacementIsFollowMouseActive,
    selectPlacementTransparency,
    selectPlacementXOffset,
    selectPlacementYOffset,
    selectShouldShowFileInput,
    selectShouldShowPlacementConfiguration,
    selectShouldShowUrlInput,
} from '../../store/slices/overlaySlice';
import { ShareOverlayButton } from '../shareOverlayModal/shareOverlayButton';

import { OverlayUrlInput } from './overlayUrlInput';

function useFollowMouseConfiguration() {
    const dispatch = useAppDispatch();
    const placementIsFollowMouseActive = useAppSelector(selectPlacementIsFollowMouseActive);
    const hoverPixel = useAppSelector(selectHoverPixel);

    useEffect(() => {
        if (placementIsFollowMouseActive) {
            dispatch(overlaySlice.actions.setPlacementXOffset(hoverPixel.x));
            dispatch(overlaySlice.actions.setPlacementYOffset(hoverPixel.y));
        }
    }, [dispatch, placementIsFollowMouseActive, hoverPixel]);

    useEffect(() => {
        viewport.onMouseUp = (e) => {
            if (e.button !== 0) return;
            dispatch(overlaySlice.actions.setPlacementIsFollowMouseActive(false));
        };
        // dispatch(overlaySlice.actions.togglePlacementFollowMouse());
    }, [dispatch]);
}

const OverlayConfig: React.FC = () => {
    const [inputUrl, setInputUrl] = React.useState('');
    const inputImageDebouced = useDebounce(inputUrl, 500);
    useFollowMouseConfiguration();
    const dispatch = useAppDispatch();
    const isModificationsAvailable = useAppSelector(selectIsModificationsAvailable);
    const inputUrlState = useAppSelector(selectInputUrl);
    const shouldShowFileInput = useAppSelector(selectShouldShowFileInput);
    const shouldShowUrlInput = useAppSelector(selectShouldShowUrlInput);
    const shouldShowPlacementConfiguration = useAppSelector(selectShouldShowPlacementConfiguration);
    const placementXOffset = useAppSelector(selectPlacementXOffset);
    const placementYOffset = useAppSelector(selectPlacementYOffset);
    const placementTransparency = useAppSelector(selectPlacementTransparency);
    const placementIsFollowMouseActive = useAppSelector(selectPlacementIsFollowMouseActive);
    const placementAutoSelectColor = useAppSelector(selectPlacementAutoSelectColor);
    const modifierShouldConvertColors = useAppSelector(selectModifierShouldConvertColors);
    const isOutputImageProcessing = useAppSelector(selectIsOutputImageProcessing);
    const modifierImageBrightness = useAppSelector(selectModifierImageBrightness);
    const inputImageLoadingStatus = useAppSelector(selectInputImageLoadingStatus);

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) dispatch(setInputImageAction(selectedFile));
    };
    const handleClearInput = () => {
        dispatch(clearInputImageAction());
    };
    const handleXOffsetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const numValue = parseInt(e.target.value, 10);
        if (Number.isNaN(numValue)) return;
        if (numValue !== placementXOffset) dispatch(overlaySlice.actions.setPlacementXOffset(numValue));
    };
    const handleYOffsetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const numValue = parseInt(e.target.value, 10);
        if (Number.isNaN(numValue)) return;
        if (numValue !== placementYOffset) dispatch(overlaySlice.actions.setPlacementYOffset(numValue));
    };
    const handleTransparencyChange = (e: Event, value: number | number[]) => {
        if (typeof value !== 'number') {
            return;
        }
        dispatch(overlaySlice.actions.setPlacementTransparency(value));
    };
    const handleFollowMouseChange = () => {
        dispatch(overlaySlice.actions.setPlacementIsFollowMouseActive(!placementIsFollowMouseActive));
    };
    const handleShouldConvertColorsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        dispatch(overlaySlice.actions.setModifierShouldConvertColors(e.target.checked));
    };
    const handleAutoSelectColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        dispatch(overlaySlice.actions.setPlacementAutoSelectColor(e.target.checked));
    };
    const handleImageBrightnessChange = (e: Event, value: number | number[]) => {
        if (typeof value !== 'number' || isOutputImageProcessing) {
            return;
        }
        dispatch(overlaySlice.actions.setModifierImageBrightness(value));
    };

    useEffect(() => {
        dispatch(setInputImageAction(inputImageDebouced));
    }, [dispatch, inputImageDebouced]);

    useEffect(() => {
        setInputUrl(inputUrlState ?? '');
    }, [inputUrlState]);

    return (
        <Box component="form">
            {!shouldShowUrlInput ? null : (
                <div>
                    <OverlayUrlInput />
                    {!isModificationsAvailable && inputUrlState && inputImageLoadingStatus === 'error' && (
                        <Tooltip title="Some features will not work. Most likely that current url does not support CORS requests. Some example sites that work: https://postimages.org/, https://imgur.com/, https://dropbox.com/ (For dropbox modify the url before using, replace 'www.dropbox.' with 'dl.dropboxusercontent.' )">
                            <WarningIcon />
                        </Tooltip>
                    )}
                    <br />
                </div>
            )}
            {!shouldShowFileInput ? null : (
                <div>
                    <Input type="file" onChange={handleFileInputChange} />
                    <br />
                </div>
            )}
            {shouldShowPlacementConfiguration && (
                <>
                    <Button onClick={handleClearInput}>Clear input</Button>
                    <br />
                    <TextField label="X" type="number" value={placementXOffset} onInput={handleXOffsetChange} />
                    <TextField label="Y" type="number" value={placementYOffset} onInput={handleYOffsetChange} />
                    <br />
                    <Button variant={placementIsFollowMouseActive ? 'outlined' : undefined} onClick={handleFollowMouseChange}>
                        Position with mouse
                    </Button>
                    <br />
                    <Typography id="transparency-slider" gutterBottom>
                        Transparency
                    </Typography>
                    <Slider
                        defaultValue={70}
                        getAriaValueText={(v): string => {
                            return v.toString(10);
                        }}
                        aria-labelledby="transparency-slider"
                        valueLabelDisplay="auto"
                        step={1}
                        min={0}
                        max={100}
                        value={placementTransparency}
                        onChange={handleTransparencyChange}
                    />
                </>
            )}
            {isModificationsAvailable && (
                <>
                    <br />
                    <FormControlLabel
                        control={<Checkbox color="primary" checked={modifierShouldConvertColors} onChange={handleShouldConvertColorsChange} />}
                        label="Convert colors"
                        labelPlacement="end"
                    />
                    <br />
                    <Tooltip title="Will try to only place colors matching the image">
                        <FormControlLabel control={<Checkbox color="primary" checked={placementAutoSelectColor} onChange={handleAutoSelectColorChange} />} label="Auto color*" labelPlacement="end" />
                    </Tooltip>
                    <br />
                    <div style={{ display: modifierShouldConvertColors ? '' : 'none' }}>
                        <Typography id="brightness-slider" gutterBottom>
                            Image brightness
                        </Typography>
                        <Slider
                            disabled={isOutputImageProcessing}
                            defaultValue={15}
                            getAriaValueText={(v): string => {
                                return v.toString(10);
                            }}
                            aria-labelledby="brightness-slider"
                            valueLabelDisplay="auto"
                            step={1}
                            min={-20}
                            max={20}
                            value={modifierImageBrightness}
                            onChange={handleImageBrightnessChange}
                        />
                    </div>
                </>
            )}
            <br />
            <ShareOverlayButton />
        </Box>
    );
};

export default OverlayConfig;
