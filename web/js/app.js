const hostUrl = window.location.hostname;
const port = window.location.port;
console.log({hostUrl, port})

function parseUrl(route) {
    const portPart = port !== "" ? `:${port}` : ""
    return `http://${hostUrl}${portPart}/${route}`
}

const workflow = {
    "3": {
        "inputs": {
            "seed": 1005530851743040,
            "steps": 4,
            "cfg": 1,
            "sampler_name": "dpmpp_sde",
            "scheduler": "karras",
            "denoise": 1,
            "model": [
                "4",
                0
            ],
            "positive": [
                "6",
                0
            ],
            "negative": [
                "7",
                0
            ],
            "latent_image": [
                "5",
                0
            ]
        },
        "class_type": "KSampler",
        "_meta": {
            "title": "KSampler"
        }
    },
    "4": {
        "inputs": {
            "ckpt_name": "RealVisXL_V4.0_Lightning.safetensors"
        },
        "class_type": "CheckpointLoaderSimple",
        "_meta": {
            "title": "Load Checkpoint"
        }
    },
    "5": {
        "inputs": {
            "width": 512,
            "height": 512,
            "batch_size": 1
        },
        "class_type": "EmptyLatentImage",
        "_meta": {
            "title": "Empty Latent Image"
        }
    },
    "6": {
        "inputs": {
            "text": "beautiful scenery nature glass bottle landscape, , purple galaxy bottle",
            "clip": [
                "4",
                1
            ]
        },
        "class_type": "CLIPTextEncode",
        "_meta": {
            "title": "CLIP Text Encode (Prompt)"
        }
    },
    "7": {
        "inputs": {
            "text": "text, watermark",
            "clip": [
                "4",
                1
            ]
        },
        "class_type": "CLIPTextEncode",
        "_meta": {
            "title": "CLIP Text Encode (Prompt)"
        }
    },
    "8": {
        "inputs": {
            "samples": [
                "3",
                0
            ],
            "vae": [
                "4",
                2
            ]
        },
        "class_type": "VAEDecode",
        "_meta": {
            "title": "VAE Decode"
        }
    },
    "11": {
        "inputs": {
            "filename_prefix": "output",
            "images": [
                "8",
                0
            ]
        },
        "class_type": "SaveImage",
        "_meta": {
            "title": "Save Image"
        }
    }
}

let queueSize = 0;
let historyList = [];

function uuidv4() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
}

const client_id = uuidv4();

console.log({workflow});


const server_address = `${window.location.hostname}:${window.location.port}`
console.log(client_id);
const socket_address = `ws://${server_address}/ws?clientId=${client_id}`
console.log(socket_address)
const socket = new WebSocket(socket_address)

socket.addEventListener('open', (event) => {
    console.log("connected to the server");
});

socket.addEventListener('message', onWsMessage);


function onWsMessage(event) {
    const eventData = JSON.parse(event.data)
    if (eventData.type === "progress") {
        // {"type": "progress", "data": {"value": 2, "max": 4, "prompt_id": "44d3afd8-d45d-4f9b-bd14-fd3d3cbacb4c", "node": null}}
        setProgress(eventData.data.value, eventData.data.max)
    }

    if (eventData.type === "status") {
        // {"type": "status", "data": {"status": {"exec_info": {"queue_remaining": 0}}}}
        queueSize = eventData.data.status.exec_info.queue_remaining
        // Execution finished
        if (queueSize === 0) {
            fetchHistory()
            setProgress(0, 1)
        }
    }
}

function triggerPrompt() {
    const promptText = document.getElementById("positive").value
    prompt(promptText)
}

function fetchHistory() {
    fetch(parseUrl("history"))
        .then(response => response.json())
        .then(data => {
            historyList = data
            render_history_queue(data)
            const lastHistoryObj = Object.entries(data).at(-1)[1]
            if (Object.keys(data).length > 0) {
                setOutputObject(lastHistoryObj)
            }
        })
        .catch(error => console.log({error}))
}

function prompt(promptString) {
    const previousSeed = workflow["3"].input.seed
    workflow["3"].inputs.seed = previousSeed + 1

    workflow["6"].inputs.text = promptString
    fetch(parseUrl("prompt"), {
        method: "POST",
        body: JSON.stringify({prompt: workflow ?? {}}),
        headers: {
            "Content-Type": "application/json"
        }
    })
}

function render_history_queue(list) {
    const promptQueue = document.getElementById("history-queue");
    promptQueue.innerHTML = "";
    Object.entries(list).forEach(([k, v], index) => {
        const imageName = v.outputs["11"].images[0].filename
        const output = {
            id: k,
            image: imageName,
            // http://localhost:8188/view?filename=ComfyUI_temp_zvgzv_00001_.png&subfolder=&type=temp
            imageUrl: parseUrl(`view?filename=${imageName}&subfolder=&type=output`)
        }
        const div = document.createElement("div");
        div.className = "history-item cursor-pointer border border-gray-700 flex-shrink-0";
        div.innerHTML = `<img class="h-20 w-20" src="${output.imageUrl}" alt="output image">`;
        div.addEventListener('click', () => setOutputObject(v))
        promptQueue.appendChild(div);
    });
}

function setProgress(currentStep, totalSteps) {
    const progress = document.getElementById("progress-bar-inner");
    const percentage = (currentStep / totalSteps) * 100;
    progress.style.width = `${percentage}%`;
}

function setOutputObject(historyObj) {
    const outputImage = document.getElementById("output-image");
    const imageName = historyObj.outputs["11"].images[0].filename
    outputImage.src = parseUrl(`view?filename=${imageName}&subfolder=&type=output`)

    const outputLink = document.getElementById("output-link");
    outputLink.href = parseUrl(`view?filename=${imageName}&subfolder=&type=output`)

    const positivePrompt = document.getElementById("positive");
    const objPrompt = historyObj.prompt[2][6].inputs.text;
    positivePrompt.value = objPrompt

}

fetchHistory()
