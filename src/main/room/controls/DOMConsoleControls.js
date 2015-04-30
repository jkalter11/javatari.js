// Copyright 2015 by Paulo Augusto Peccin. See license.txt distributed with this file.

JavatariCode.DOMConsoleControls = function() {
    var self = this;

    function init() {
        gamepadControls = new JavatariCode.GamepadConsoleControls(self);
        initKeys();
    }

    this.connect = function(pControlsSocket, pCartridgeSocket) {
        if (cartridgeSocket) cartridgeSocket.removeInsertionListener(this);
        cartridgeSocket = pCartridgeSocket;
        cartridgeSocket.addInsertionListener(this);
        consoleControlsSocket = pControlsSocket;
        consoleControlsSocket.connectControls(this);
        gamepadControls.connect(pControlsSocket);
    };

    this.connectPeripherals = function(screen, consolePanel) {
        videoMonitor = screen.getMonitor();
        gamepadControls.connectScreen(screen);
        this.addInputElements(screen.keyControlsInputElements());
        if (consolePanel) this.addInputElements(consolePanel.keyControlsInputElements());
    };

    this.powerOn = function() {
        gamepadControls.powerOn();
        if (PADDLES_MODE === 0) setPaddleMode(false, false);
        else if (PADDLES_MODE === 1) setPaddleMode(true, false);
    };

    this.powerOff = function() {
        setPaddleMode(false, false);
        gamepadControls.powerOff();
    };

    this.destroy = function() {
    };

    this.addInputElements = function(elements) {
        for (var i = 0; i < elements.length; i++) {
            elements[i].addEventListener("keydown", this.filteredKeyPressed);
            elements[i].addEventListener("keyup", this.filteredKeyReleased);
        }
    };

    this.toggleP1ControlsMode = function() {
        this.setP1ControlsMode(!p1ControlsMode);
        showModeOSD();
    };

    this.setP1ControlsMode = function(state) {
        p1ControlsMode = state;
        gamepadControls.setP1ControlsMode(state);
        this.applyPreferences();
    };

    this.isP1ControlsMode = function() {
        return p1ControlsMode;
    };

    this.togglePaddleMode = function() {
        setPaddleMode(!paddleMode, true);
    };

    this.isPaddleMode = function() {
        return paddleMode;
    };

    this.getGamepadControls = function() {
        return gamepadControls;
    };

    this.filteredKeyPressed = function(event) {
        var modifiers = 0 | (event.ctrlKey ? KEY_CTRL_MASK : 0) | (event.altKey ? KEY_ALT_MASK : 0) | (event.shiftKey ? KEY_SHIFT_MASK : 0);
        if (processKeyEvent(event.keyCode, true, modifiers))
            event.preventDefault();
    };

    this.filteredKeyReleased = function(event) {
        var modifiers = 0 | (event.ctrlKey ? KEY_CTRL_MASK : 0) | (event.altKey ? KEY_ALT_MASK : 0) | (event.shiftKey ? KEY_SHIFT_MASK : 0);
        if (processKeyEvent(event.keyCode, false, modifiers))
            event.preventDefault();
    };

    this.cartridgeInserted = function(cartridge) {
        if (!cartridge || PADDLES_MODE >= 0) return;	// Does not interfere if Paddle Mode is forced
        var usePaddles = cartridge.rom.info.p === 1;
        if (paddleMode !== usePaddles) setPaddleMode(usePaddles, false);
    };

    this.clockPulse = function() {
        gamepadControls.clockPulse();
        if (!paddleMode) return;
        // Update paddles position as time passes
        if (paddle0MovingRight) {
            if (!paddle0MovingLeft) {
                paddle0Position -= paddle0Speed;
                if (paddle0Position < 0) paddle0Position = 0;
                consoleControlsSocket.controlValueChanged(controls.PADDLE0_POSITION, paddle0Position);
            }
        } else if (paddle0MovingLeft) {
            paddle0Position += paddle0Speed;
            if (paddle0Position > 380) paddle0Position = 380;
            consoleControlsSocket.controlValueChanged(controls.PADDLE0_POSITION, paddle0Position);
        }
        if (paddle1MovingRight) {
            if (!paddle1MovingLeft) {
                paddle1Position -= paddle1Speed;
                if (paddle1Position < 0) paddle1Position = 0;
                consoleControlsSocket.controlValueChanged(controls.PADDLE1_POSITION, paddle1Position);
            }
        } else if (paddle1MovingLeft) {
            paddle1Position += paddle1Speed;
            if (paddle1Position > 380) paddle1Position = 380;
            consoleControlsSocket.controlValueChanged(controls.PADDLE1_POSITION, paddle1Position);
        }
    };

    this.processKeyEvent = function(keyCode, press, modifiers) {
        if (checkLocalControlKey(keyCode, modifiers, press)) return true;
        var control = controlForEvent(keyCode, modifiers);
        if (control == null) return false;

        if (paddleMode)	control = translatePaddleModeButtons(control);
        var state = controlStateMap[control];
        if (!state || (state !== press)) {
            controlStateMap[control] = press;
            consoleControlsSocket.controlStateChanged(control, press);
        }
        return true;
    };

    var processKeyEvent = this.processKeyEvent;

    var showModeOSD = function() {
        videoMonitor.showOSD("Controllers: " + (paddleMode ? "Paddles" : "Joysticks") + (p1ControlsMode ? ", Swapped" : ""), true);
    };

    var setPaddleMode = function(mode, showOSD) {
        paddleMode = mode;
        paddle0MovingLeft = paddle0MovingRight = paddle1MovingLeft = paddle1MovingRight = false;
        paddle0Speed = paddle1Speed = 2;
        paddle0Position = paddle1Position = (paddleMode ? 190 : -1);	// -1 = disconnected, won't charge POTs
        // Reset all controls to default state
        for (var i = 0; i < controls.playerDigitalControls.length; i++) {
            consoleControlsSocket.controlStateChanged(controls.playerDigitalControls[i], false);
        }
        consoleControlsSocket.controlValueChanged(controls.PADDLE0_POSITION, paddle0Position);
        consoleControlsSocket.controlValueChanged(controls.PADDLE1_POSITION, paddle1Position);
        gamepadControls.setPaddleMode(paddleMode);
        if (showOSD) showModeOSD();
    };

    var checkLocalControlKey = function(keyCode, modif, press) {
        var control;
        if (press) {
            if (modif === KEY_ALT_MASK)
                switch(keyCode) {
                    case KEY_TOGGLE_P1_MODE:
                        self.toggleP1ControlsMode();
                        return true;
                    case KEY_TOGGLE_JOYSTICK:
                        gamepadControls.toggleMode();
                        return true;
                    case KEY_TOGGLE_PADDLE:
                        self.togglePaddleMode();
                        return true;
                }
            if (paddleMode) {
                control = controlForEvent(keyCode, modif);
                if (control == null) return false;
                switch(control) {
                    case controls.JOY0_LEFT:
                        paddle0MovingLeft = true; return true;
                    case controls.JOY0_RIGHT:
                        paddle0MovingRight = true; return true;
                    case controls.JOY0_UP:
                        if (paddle0Speed < 10) paddle0Speed++;
                        videoMonitor.showOSD("P1 Paddle speed: " + paddle0Speed, true);
                        return true;
                    case controls.JOY0_DOWN:
                        if (paddle0Speed > 1) paddle0Speed--;
                        videoMonitor.showOSD("P1 Paddle speed: " + paddle0Speed, true);
                        return true;
                    case controls.JOY1_LEFT:
                        paddle1MovingLeft = true; return true;
                    case controls.JOY1_RIGHT:
                        paddle1MovingRight = true; return true;
                    case controls.JOY1_UP:
                        if (paddle1Speed < 10) paddle1Speed++;
                        videoMonitor.showOSD("P2 Paddle speed: " + paddle1Speed, true);
                        return true;
                    case controls.JOY1_DOWN:
                        if (paddle1Speed > 1) paddle1Speed--;
                        videoMonitor.showOSD("P2 Paddle speed: " + paddle1Speed, true);
                        return true;
                }
            }
        } else {
            if (paddleMode) {
                control = controlForEvent(keyCode, modif);
                if (control == null) return false;
                switch(control) {
                    case controls.JOY0_LEFT:
                        paddle0MovingLeft = false; return true;
                    case controls.JOY0_RIGHT:
                        paddle0MovingRight = false; return true;
                    case controls.JOY1_LEFT:
                        paddle1MovingLeft = false; return true;
                    case controls.JOY1_RIGHT:
                        paddle1MovingRight = false; return true;
                }
            }
        }
        return false;
    };

    var controlForEvent = function(keyCode, modif) {
        switch (modif) {
            case 0:
                var joy = joyKeysCodeMap[keyCode];
                if (joy) return joy;
                return normalCodeMap[keyCode];
            case KEY_CTRL_MASK:
                return withCTRLCodeMap[keyCode];
            case KEY_ALT_MASK:
                return withALTCodeMap[keyCode];
        }
        return null;
    };

    var translatePaddleModeButtons = function(control) {
        switch (control) {
            case controls.JOY0_BUTTON: return controls.PADDLE0_BUTTON;
            case controls.JOY1_BUTTON: return controls.PADDLE1_BUTTON;
        }
        return control;
    };

    var initKeys = function() {
        self.applyPreferences();

        normalCodeMap[KEY_POWER]            = controls.POWER;
        normalCodeMap[KEY_BLACK_WHITE]      = controls.BLACK_WHITE;
        normalCodeMap[KEY_DIFFICULTY0]      = controls.DIFFICULTY0;
        normalCodeMap[KEY_CARTRIDGE_REMOVE] = controls.CARTRIDGE_REMOVE;
        normalCodeMap[KEY_SAVE_STATE_FILE]  = controls.SAVE_STATE_FILE;
        normalCodeMap[KEY_DIFFICULTY1]      = controls.DIFFICULTY1;
        normalCodeMap[KEY_SELECT]           = controls.SELECT;
        normalCodeMap[KEY_SELECT2]          = controls.SELECT;
        normalCodeMap[KEY_RESET]            = controls.RESET;

        withALTCodeMap[KEY_POWER]            = controls.POWER;
        withALTCodeMap[KEY_BLACK_WHITE]      = controls.BLACK_WHITE;
        withALTCodeMap[KEY_DIFFICULTY0]      = controls.DIFFICULTY0;
        withALTCodeMap[KEY_CARTRIDGE_REMOVE] = controls.CARTRIDGE_REMOVE;
        withALTCodeMap[KEY_SAVE_STATE_FILE]  = controls.SAVE_STATE_FILE;
        withALTCodeMap[KEY_DIFFICULTY1]      = controls.DIFFICULTY1;
        withALTCodeMap[KEY_SELECT]           = controls.SELECT;
        withALTCodeMap[KEY_SELECT2]          = controls.SELECT;
        withALTCodeMap[KEY_RESET]            = controls.RESET;

        normalCodeMap[KEY_FAST_SPEED] = controls.FAST_SPEED;

        withALTCodeMap[KEY_PAUSE]          = controls.PAUSE;
        withALTCodeMap[KEY_FRAME]          = controls.FRAME;
        withALTCodeMap[KEY_TRACE]          = controls.TRACE;
        withALTCodeMap[KEY_DEBUG]          = controls.DEBUG;
        withALTCodeMap[KEY_NO_COLLISIONS]  = controls.NO_COLLISIONS;
        withALTCodeMap[KEY_VIDEO_STANDARD] = controls.VIDEO_STANDARD;

        withCTRLCodeMap[KEY_POWER] = controls.POWER_FRY;

        withCTRLCodeMap[KEY_STATE_0] = controls.SAVE_STATE_0;
        withCTRLCodeMap[KEY_STATE_0a] = controls.SAVE_STATE_0;
        withCTRLCodeMap[KEY_STATE_1] = controls.SAVE_STATE_1;
        withCTRLCodeMap[KEY_STATE_2] = controls.SAVE_STATE_2;
        withCTRLCodeMap[KEY_STATE_3] = controls.SAVE_STATE_3;
        withCTRLCodeMap[KEY_STATE_4] = controls.SAVE_STATE_4;
        withCTRLCodeMap[KEY_STATE_5] = controls.SAVE_STATE_5;
        withCTRLCodeMap[KEY_STATE_6] = controls.SAVE_STATE_6;
        withCTRLCodeMap[KEY_STATE_7] = controls.SAVE_STATE_7;
        withCTRLCodeMap[KEY_STATE_8] = controls.SAVE_STATE_8;
        withCTRLCodeMap[KEY_STATE_9] = controls.SAVE_STATE_9;
        withCTRLCodeMap[KEY_STATE_10] = controls.SAVE_STATE_10;
        withCTRLCodeMap[KEY_STATE_11] = controls.SAVE_STATE_11;
        withCTRLCodeMap[KEY_STATE_11a] = controls.SAVE_STATE_11;
        withCTRLCodeMap[KEY_STATE_12] = controls.SAVE_STATE_12;
        withCTRLCodeMap[KEY_STATE_12a] = controls.SAVE_STATE_12;

        withALTCodeMap[KEY_STATE_0] = controls.LOAD_STATE_0;
        withALTCodeMap[KEY_STATE_0a] = controls.LOAD_STATE_0;
        withALTCodeMap[KEY_STATE_1] = controls.LOAD_STATE_1;
        withALTCodeMap[KEY_STATE_2] = controls.LOAD_STATE_2;
        withALTCodeMap[KEY_STATE_3] = controls.LOAD_STATE_3;
        withALTCodeMap[KEY_STATE_4] = controls.LOAD_STATE_4;
        withALTCodeMap[KEY_STATE_5] = controls.LOAD_STATE_5;
        withALTCodeMap[KEY_STATE_6] = controls.LOAD_STATE_6;
        withALTCodeMap[KEY_STATE_7] = controls.LOAD_STATE_7;
        withALTCodeMap[KEY_STATE_8] = controls.LOAD_STATE_8;
        withALTCodeMap[KEY_STATE_9] = controls.LOAD_STATE_9;
        withALTCodeMap[KEY_STATE_10] = controls.LOAD_STATE_10;
        withALTCodeMap[KEY_STATE_11] = controls.LOAD_STATE_11;
        withALTCodeMap[KEY_STATE_11a] = controls.LOAD_STATE_11;
        withALTCodeMap[KEY_STATE_12] = controls.LOAD_STATE_12;
        withALTCodeMap[KEY_STATE_12a] = controls.LOAD_STATE_12;

        withALTCodeMap[KEY_CARTRIDGE_FORMAT]    = controls.CARTRIDGE_FORMAT;
        withALTCodeMap[KEY_CARTRIDGE_CLOCK_DEC] = controls.CARTRIDGE_CLOCK_DEC;
        withALTCodeMap[KEY_CARTRIDGE_CLOCK_INC] = controls.CARTRIDGE_CLOCK_INC;
    };

    this.applyPreferences = function() {
        joyKeysCodeMap = {};
        if (!p1ControlsMode) {
            joyKeysCodeMap[Javatari.preferences.KP0LEFT]  = controls.JOY0_LEFT;
            joyKeysCodeMap[Javatari.preferences.KP0UP]    = controls.JOY0_UP;
            joyKeysCodeMap[Javatari.preferences.KP0RIGHT] = controls.JOY0_RIGHT;
            joyKeysCodeMap[Javatari.preferences.KP0DOWN]  = controls.JOY0_DOWN;
            joyKeysCodeMap[Javatari.preferences.KP0BUT]   = controls.JOY0_BUTTON;
            joyKeysCodeMap[Javatari.preferences.KP0BUT2]  = controls.JOY0_BUTTON;
            joyKeysCodeMap[Javatari.preferences.KP1LEFT]  = controls.JOY1_LEFT;
            joyKeysCodeMap[Javatari.preferences.KP1UP]    = controls.JOY1_UP;
            joyKeysCodeMap[Javatari.preferences.KP1RIGHT] = controls.JOY1_RIGHT;
            joyKeysCodeMap[Javatari.preferences.KP1DOWN ] = controls.JOY1_DOWN;
            joyKeysCodeMap[Javatari.preferences.KP1BUT]   = controls.JOY1_BUTTON;
            joyKeysCodeMap[Javatari.preferences.KP1BUT2]  = controls.JOY1_BUTTON;
        } else {
            joyKeysCodeMap[Javatari.preferences.KP0LEFT]  = controls.JOY1_LEFT;
            joyKeysCodeMap[Javatari.preferences.KP0UP]    = controls.JOY1_UP;
            joyKeysCodeMap[Javatari.preferences.KP0RIGHT] = controls.JOY1_RIGHT;
            joyKeysCodeMap[Javatari.preferences.KP0DOWN]  = controls.JOY1_DOWN;
            joyKeysCodeMap[Javatari.preferences.KP0BUT]   = controls.JOY1_BUTTON;
            joyKeysCodeMap[Javatari.preferences.KP0BUT2]  = controls.JOY1_BUTTON;
            joyKeysCodeMap[Javatari.preferences.KP1LEFT]  = controls.JOY0_LEFT;
            joyKeysCodeMap[Javatari.preferences.KP1UP]    = controls.JOY0_UP;
            joyKeysCodeMap[Javatari.preferences.KP1RIGHT] = controls.JOY0_RIGHT;
            joyKeysCodeMap[Javatari.preferences.KP1DOWN]  = controls.JOY0_DOWN;
            joyKeysCodeMap[Javatari.preferences.KP1BUT]   = controls.JOY0_BUTTON;
            joyKeysCodeMap[Javatari.preferences.KP1BUT2]  = controls.JOY0_BUTTON;
        }
    };

    var controls = JavatariCode.ConsoleControls;

    var p1ControlsMode = false;
    var paddleMode = false;

    var consoleControlsSocket;
    var cartridgeSocket;
    var videoMonitor;
    var gamepadControls;

    var paddle0Position = 0;			// 380 = LEFT, 190 = MIDDLE, 0 = RIGHT
    var paddle0Speed = 3;				// 1 to 10
    var paddle0MovingLeft = false;
    var paddle0MovingRight = false;
    var paddle1Position = 0;
    var paddle1Speed = 3;
    var paddle1MovingLeft = false;
    var paddle1MovingRight = false;

    var joyKeysCodeMap = {};
    var normalCodeMap = {};
    var withCTRLCodeMap = {};
    var withALTCodeMap = {};

    var controlStateMap =  {};

    var PADDLES_MODE = Javatari.PADDLES_MODE;


    // Default Key Values

    var KEY_TOGGLE_JOYSTICK  = JavatariCode.DOMConsoleControls.KEY_TOGGLE_JOYSTICK;
    var KEY_TOGGLE_P1_MODE   = JavatariCode.DOMConsoleControls.KEY_TOGGLE_P1_MODE;
    var KEY_TOGGLE_PADDLE    = JavatariCode.DOMConsoleControls.KEY_TOGGLE_PADDLE;
    var KEY_CARTRIDGE_FORMAT = JavatariCode.DOMConsoleControls.KEY_CARTRIDGE_FORMAT;
    var KEY_SELECT           = JavatariCode.DOMConsoleControls.KEY_SELECT;
    var KEY_SELECT2          = JavatariCode.DOMConsoleControls.KEY_SELECT2;
    var KEY_RESET            = JavatariCode.DOMConsoleControls.KEY_RESET;
    var KEY_FAST_SPEED       = JavatariCode.DOMConsoleControls.KEY_FAST_SPEED;
    var KEY_PAUSE            = JavatariCode.DOMConsoleControls.KEY_PAUSE;

    var KEY_POWER            = JavatariCode.Keys.VK_F1.c;
    var KEY_BLACK_WHITE      = JavatariCode.Keys.VK_F2.c;
    var KEY_DIFFICULTY0      = JavatariCode.Keys.VK_F4.c;
    var KEY_DIFFICULTY1      = JavatariCode.Keys.VK_F9.c;

    var KEY_FRAME            = JavatariCode.Keys.VK_F.c;
    var KEY_TRACE            = JavatariCode.Keys.VK_Q.c;
    var KEY_DEBUG            = JavatariCode.Keys.VK_D.c;
    var KEY_NO_COLLISIONS    = JavatariCode.Keys.VK_C.c;
    var KEY_VIDEO_STANDARD   = JavatariCode.Keys.VK_V.c;

    var KEY_STATE_0          = JavatariCode.Keys.VK_QUOTE.c;
    var KEY_STATE_0a         = JavatariCode.Keys.VK_QUOTE2.c;
    var KEY_STATE_1          = JavatariCode.Keys.VK_1.c;
    var KEY_STATE_2          = JavatariCode.Keys.VK_2.c;
    var KEY_STATE_3          = JavatariCode.Keys.VK_3.c;
    var KEY_STATE_4          = JavatariCode.Keys.VK_4.c;
    var KEY_STATE_5          = JavatariCode.Keys.VK_5.c;
    var KEY_STATE_6          = JavatariCode.Keys.VK_6.c;
    var KEY_STATE_7          = JavatariCode.Keys.VK_7.c;
    var KEY_STATE_8          = JavatariCode.Keys.VK_8.c;
    var KEY_STATE_9          = JavatariCode.Keys.VK_9.c;
    var KEY_STATE_10         = JavatariCode.Keys.VK_0.c;
    var KEY_STATE_11         = JavatariCode.Keys.VK_MINUS.c;
    var KEY_STATE_11a        = JavatariCode.Keys.VK_MINUS2.c;
    var KEY_STATE_12         = JavatariCode.Keys.VK_EQUALS.c;
    var KEY_STATE_12a        = JavatariCode.Keys.VK_EQUALS2.c;

    var KEY_SAVE_STATE_FILE  = JavatariCode.Keys.VK_F8.c;

    var KEY_CARTRIDGE_CLOCK_DEC = JavatariCode.Keys.VK_END.c;
    var KEY_CARTRIDGE_CLOCK_INC = JavatariCode.Keys.VK_HOME.c;
    var KEY_CARTRIDGE_REMOVE    = JavatariCode.Keys.VK_F7.c;

    var KEY_CTRL_MASK  = 1;
    var KEY_ALT_MASK   = JavatariCode.DOMConsoleControls.KEY_ALT_MASK;
    var KEY_SHIFT_MASK = 4;


    init();

};

JavatariCode.DOMConsoleControls.KEY_SELECT     = JavatariCode.Keys.VK_F11.c;
JavatariCode.DOMConsoleControls.KEY_SELECT2    = JavatariCode.Keys.VK_F10.c;
JavatariCode.DOMConsoleControls.KEY_RESET      = JavatariCode.Keys.VK_F12.c;
JavatariCode.DOMConsoleControls.KEY_FAST_SPEED = JavatariCode.Keys.VK_TAB.c;
JavatariCode.DOMConsoleControls.KEY_PAUSE      = JavatariCode.Keys.VK_P.c;

JavatariCode.DOMConsoleControls.KEY_TOGGLE_JOYSTICK  = JavatariCode.Keys.VK_J.c;
JavatariCode.DOMConsoleControls.KEY_TOGGLE_P1_MODE   = JavatariCode.Keys.VK_K.c;
JavatariCode.DOMConsoleControls.KEY_TOGGLE_PADDLE    = JavatariCode.Keys.VK_L.c;
JavatariCode.DOMConsoleControls.KEY_CARTRIDGE_FORMAT = JavatariCode.Keys.VK_B.c;

JavatariCode.DOMConsoleControls.KEY_ALT_MASK   = 2;
