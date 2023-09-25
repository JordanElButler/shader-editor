"use strict";

const canvasWidth = 400;
const canvasHeight = 200;

const glTypes = {
    FLOAT: "float",
    IVEC2: "ivec2",
    VEC2: "vec2",
};

function glTypesToShaderDecl(gl, glType) {
    return glType;
}

function glTypesToUniformSetter(gl, glType) {
    switch (glType) {
        case glTypes.FLOAT:
            return gl.uniform1f;
        case glTypes.IVEC2:
            return gl.uniform2iv;
        case glTypes.VEC2:
            return (
                (uLoc, v) => {
                    const { x, y } = v;
                    gl.uniform2v(uLoc, x, y);
                }
            );
        default:
            throw Error(`unimplemented glType glTypesToUniformSetter:\n${glType}`)
    }
}
function glUniformSetter(gl, uLoc, u) {
    switch (u.glType) {
        case glTypes.FLOAT:
            gl.uniform1f(uLoc, u.getValue());
            break;
        case glTypes.VEC2:
            const { x, y } = u.getValue();
            gl.uniform2f(uLoc, x, y);
            break;
        default:
            throw Error(`unimplemented glType glTypesToUniformSetter:\n${glType}`)
    }
}
function glTypesToAttribSize(gl, glType) {
    switch (glType) {
        case glTypes.FLOAT:
            return 1;
        case glTypes.IVEC2:
            return 2;
        case glTypes.VEC2:
            return 2;
        default:
            throw Error(`unimplemented glType glTypesToAttribSize:\n${glType}`)
    }
}

function glTypesToAttribType(gl, glType) {
    switch (glType) {
        case glTypes.FLOAT:
            return gl.FLOAT;
        case glTypes.IVEC2:
            return gl.INT;
        case glTypes.VEC2:
            return gl.FLOAT;
        default:
            throw Error(`unimplemented glType glTypesToAttribType:\n${glType}`);
    }
}

const quadVertextShaderText =
`attribute vec2 a_pos;
void main() {
    gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

const basicShaderText = 
`void main()
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = gl_FragCoord.xy / iResolution.xy;

    // Time varying pixel color
    vec3 col = 0.5 + 0.5*cos(iTime+uv.xyx+vec3(0,2,4));

    // Output to screen
    gl_FragColor = vec4(col,1.0);
}
`;

const array = new Float32Array([
    -0.5, 
]);

function injectAttributes(gl, vertText, attributes) {
    let src = '';
    attributes.forEach(a => {
        src += `attribute ${glTypesToShaderDecl(gl, a.glType)} ${a.name};\n`;
    })
    src += vertText;
    return src;
}
function processFragText(gl, fragText, uniforms) {
    let src = `precision highp float;\n
    `;
    uniforms.forEach(u => {
        src += `uniform ${glTypesToShaderDecl(gl,u.glType)} ${u.name};\n`;
    })
    src += fragText;
    return src;
}
function getWebglHandle(canvas) {
    const webgl = canvas.getContext("webgl2");
    if (webgl) return webgl;
    throw new Error("cannot get webgl handle, check if supported by browser");
}

function getWebglErrors(gl) {
    const errorLog = [];
    
    while (true) {
        let err = gl.getError()
        if (err === gl.NO_ERROR) break;
        errorLog.push(err);  
    }
    return errorLog;
}


function createProgram(gl, vshader, fshader) {
    const program = gl.createProgram();
    gl.attachShader(program, vshader);
    gl.attachShader(program, fshader);
    gl.linkProgram(program);

    let info = '';
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        info = gl.getProgramInfoLog(program);
    }
    const status = info ? 'Issue' : 'Ok';
    return {
        status,
        info,
        program,
    };
}

function createShader(gl, source, shader_type) {
    const shader = gl.createShader(shader_type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    let info = '';
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        info = gl.getShaderInfoLog(shader);
    }
    const status = info ? 'Issue' : 'Ok';
    return {
        status,
        info,
        shader,
        source,
    };
}

function createLinkedProgram(gl, vshader_text, fshader_text) {
    const vshader = createShader(gl, vshader_text, gl.VERTEX_SHADER);
    const fshader = createShader(gl, fshader_text, gl.FRAGMENT_SHADER);
    if (vshader.status === 'Ok' && fshader.status === 'Ok') {
        const lprogram = createProgram(gl, vshader.shader, fshader.shader);
        return {
            vshader,
            fshader,
            lprogram,
        }
    } else {
        return {
            vshader,
            fshader,
            lprogram: {
                status: 'Issue',
                info: 'no program',
                program: null,
            }
        };
    }
}

function validLinkedProgram(programState) {
    const { vshader, fshader, lprogram } = programState;
    return vshader.status === 'Ok' && fshader.status === 'Ok' && lprogram.status === 'Ok';
}

function linkedProgramError(programState) {
    const { vshader, fshader, lprogram } = programState;

    if (vshader.status !== 'Ok') return vshader.info;
    if (fshader.status !== 'Ok') return fshader.info;
    if (lprogram.status !== 'Ok') return lprogram.info;
    return '';
}

function domCompile(glState) {

    const { gl, uniforms } = glState;

    // get fragment shader text;
    const userFragText = document.getElementById('editor').value;
    const processedFragText = processFragText(gl, userFragText, uniforms);
    
    const programState = createLinkedProgram(gl, quadVertextShaderText, processedFragText);
    if (!validLinkedProgram(programState)) {
        const error_box = document.getElementById('error');
        error_box.textContent = linkedProgramError(programState);       
        return;
    }
    glState.programState = programState;
}

function setDomHandlers(appData) {
    document.getElementById('restart').addEventListener('click', () => {

    })
    document.getElementById('play-button').addEventListener('click', () => {
        appData.playing = !appData.playing;
        document.getElementById('play-button').textContent = appData.playing ? 'Pause' : 'Run';
    })
    document.getElementById('compile').addEventListener('click', () => {
        const { glState } = appData;
        domCompile(glState);
    })
    document.getElementById('save').addEventListener('click', () => {
        window.sessionStorage.setItem('editor-content', document.getElementById('editor').value)
    })
    document.getElementById('restore').addEventListener('click', () => {
        
        const savedContent = window.sessionStorage.getItem('editor-content');
        if (savedContent !== null) document.getElementById('editor').value = savedContent;
    })
}

function setupProgram(gl, program) {
    gl.useProgram(program);

    setUpUniforms(gl, program);
}

function setAttributes(gl, program, attributes) {
    attributes.forEach(a => {
        const aLoc = gl.getAttribLocation(program, a.name);
        gl.bindBuffer(gl.ARRAY_BUFFER, a.buffer);
        gl.enableVertexAttribArray(aLoc);
        gl.vertexAttribPointer(aLoc, glTypesToAttribSize(gl, a.glType), glTypesToAttribType(gl, a.glType), a.normalized, a.stride, a.offset );
    })
}

function setUniforms(gl, program, uniforms) {
    uniforms.forEach(u => {
        const uLoc = gl.getUniformLocation(program, u.name);
        glUniformSetter(gl, uLoc, u);
    })
}

function setTextures(gl, program, textures) {

}

function draw(glState) {
    const { gl, attributes, uniforms, textures, programState } = glState;
    const { program } = programState.lprogram
    gl.useProgram(program);

    setAttributes(gl, program, attributes);
    setUniforms(gl, program, uniforms);
    setTextures(gl, program, textures);

    gl.bindBuffer(gl.ARRAY_BUFFER, attributes[0].buffer)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 6);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

function looper(appData) {

    const loop = () => {
        const { glState, playing } = appData;
        if (playing) {
            draw(glState);
        }
        window.requestAnimationFrame(loop);
    }
    loop();
}


function init() {

    const canvas = document.getElementById("shader-canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    const gl = getWebglHandle(canvas);
    const uniforms = [
        {
            name: "iTime",
            glType: glTypes.FLOAT,
            getValue() {
                return performance.now() / 1000;
            }
        },
        {
            name: "iResolution",
            glType: glTypes.VEC2,
            getValue() {
                return {
                    x: canvasWidth,
                    y: canvasHeight,
                }
            }
        },
        {
            
        }
    ];

    const positions = [
        -1, 1,
        1, 1,
        -1, -1,
        1, -1,
    ];
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    const attributes = [
        {
            name: "a_pos",
            glType: glTypes.VEC2,
            normalized: false,
            stride: 0,
            offset: 0,
            buffer: positionBuffer,
        }
    ]
    
    const textures = [
    
    ]
    
    const glState = {
        gl,
        programState: null,
        uniforms,
        attributes,
        textures,
    }

    const appData = {
        playing: true,
        glState,
    }

    const editorContent = window.sessionStorage.getItem('editor-content')
    if (editorContent) {
        document.getElementById('editor').value = editorContent;
    } else {
        document.getElementById('editor').value = basicShaderText;
    }
    domCompile(glState);

    setDomHandlers(appData);

    looper(appData);

}

init();