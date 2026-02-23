import React, { useState, useRef, useCallback, useEffect } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from 'reactflow';
import { edgeStyles } from '../styles';

const DisconnectableEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimerRef = useRef(null);
  const leaveTimerRef = useRef(null);
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  const clearTimers = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    clearTimers();
    hoverTimerRef.current = setTimeout(() => setIsHovered(true), 100);
  }, [clearTimers]);

  const handleMouseLeave = useCallback(() => {
    clearTimers();
    leaveTimerRef.current = setTimeout(() => setIsHovered(false), 1000);
  }, [clearTimers]);

  const handleButtonMouseEnter = useCallback(() => {
    clearTimers();
    setIsHovered(true);
  }, [clearTimers]);

  const handleButtonMouseLeave = useCallback(() => {
    clearTimers();
    leaveTimerRef.current = setTimeout(() => setIsHovered(false), 1000);
  }, [clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const handleDisconnect = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    clearTimers();
    setIsHovered(false);
    if (data?.onDisconnect) data.onDisconnect(id);
  }, [id, data, clearTimers]);

  const buttonPosition = { x: (sourceX + targetX) / 2, y: (sourceY + targetY) / 2 };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />

      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        pointerEvents="stroke"
        style={edgeStyles.clickablePath}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />

      {isHovered && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              ...edgeStyles.disconnectButton.container,
              left: buttonPosition.x,
              top: buttonPosition.y,
              transform: 'translate(-50%, -50%)'
            }}
            onMouseEnter={handleButtonMouseEnter}
            onMouseLeave={handleButtonMouseLeave}
          >
            <button
              type="button"
              onClick={handleDisconnect}
              title="断开连接"
              style={edgeStyles.disconnectButton.button}
            >
              ✕ 断开
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default DisconnectableEdge;
