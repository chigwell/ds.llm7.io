import React, {
  useCallback,
  useEffect,
  useState,
  Fragment,
} from "react";
import {
  App,
  View,
  Page,
  Navbar,
  NavTitle,
  LoginScreen,
  LoginScreenTitle,
  Block,
  Button,
  Preloader,
  List,
  ListInput,
  ListItem,
  f7,
  Card,
  CardHeader,
  CardContent,
  Link,
} from "framework7-react";
import axios from "axios";
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';


/* -------------------------------------------------------------------------
 * Constants
 * ---------------------------------------------------------------------- */
const GA_CLIENT_ID =
  "264062651955-8qamru5vjtu9kc1tk2trsgte5e10hm0m.apps.googleusercontent.com";
const BASE_API_URL = "https://llm7-api.chigwel137.workers.dev";
const ID_TOKEN_KEY = "id_token";
const MAIN_API_URL = "https://api.llm7.io";
const IMAGE_API_URL = `${MAIN_API_URL}/prompt`;

const W_MIN = 100;
const W_MAX = 1500;
const H_MIN = 100;
const H_MAX = 1500;
const SEED_MIN = 0;
const SEED_MAX = 1_000_000_000;
const PROMPT_MAX = 10_000;

/* -------------------------------------------------------------------------
 * Component
 * ---------------------------------------------------------------------- */
function MyApp() {
  /* --------------------------- Auth state ------------------------------ */
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);

  /* ------------------------- Image generation state ------------------- */
  const [prompt, setPrompt]   = useState("");
  const [width,  setWidth]    = useState(500);          // within 100-1500
  const [height, setHeight]   = useState(500);          // within 100-1500
  const [seed,   setSeed]     = useState(0);             // within range
  const [model,  setModel]    = useState("1");           // 1 or 2
  const [token, setToken]     = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState(null);

  /* ---------------------- Dataset-specific state ---------------------- */
  const [batchSize, setBatchSize] = useState(100);
  const [aproximatlyTime, setAproximatlyTime] = useState("~ 5 minutes");
  const [datasetRows, setDatasetRows] = useState([]);
  const [isGeneratingDataset, setIsGeneratingDataset] = useState(false);
  const [isAnalysingingDataset, setIsAnalysingingDataset] = useState(false);

  const [analysisRows, setAnalysisRows] = useState([]);



  const [imageModels, setImageModels] = useState([]);
  const [selectedModels, setSelectedModels] = useState([]);
    const [aprompt, setAprompt] = useState("");

  useEffect(() => {
      const saved = localStorage.getItem('image_api_token');
      if (saved) setToken(saved);
  }, []);

  /* ----------------------- Load “image” models ----------------------- */
    useEffect(() => {
      (async () => {
        try {
          const { data } = await axios.get(`${MAIN_API_URL}/v1/models`);
          const models: string[] = (data || [])
            .filter(
              (m) =>
                Array.isArray(m?.modalities?.input) &&
                m.modalities.input.includes("image"),
            )
            .map((m) => m.id)
            .sort();
          setImageModels(models);
          setSelectedModels(models.slice(0, 1)); // default: first item
        } catch (err) {
          console.error("Failed to fetch models", err);
        }
      })();
    }, []);

  const calculateAproximatlyTime = (batchSize) => {
    // 3 seconds per image
    const timePerImage = 10; // seconds
    const totalTime = batchSize * timePerImage; // total time in seconds
    const minutes = Math.floor(totalTime / 60);
    const remainingSeconds = totalTime % 60;
    const formattedTime = `${minutes} minute${minutes !== 1 ? 's' : ''} ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`;
    setAproximatlyTime(formattedTime);
  }

  useEffect(() => {
      if (token) {
        localStorage.setItem('image_api_token', token);
      } else {
        localStorage.removeItem('image_api_token'); // keep storage tidy
      }
    }, [token]);

  /* ---- inject keyframes for shimmer once on mount -------------------- */
  useEffect(() => {
    if (!document.getElementById("shimmer-keyframes")) {
      const style = document.createElement("style");
      style.id = "shimmer-keyframes";
      style.innerHTML = `@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`;
      document.head.appendChild(style);
    }
  }, []);

  /* ---------------- Google credential response ------------------------ */
  const handleCredentialResponse = useCallback(async ({ credential }) => {
    setIsLoading(true);
    try {
      const { data } = await axios.get(`${BASE_API_URL}/verify`, {
        headers: { Authorization: `Bearer ${credential}` },
      });
      localStorage.setItem(ID_TOKEN_KEY, credential);
      setUserEmail(data.email);
      setIsAuthenticated(true);
    } catch {
      localStorage.removeItem(ID_TOKEN_KEY);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* ------------------------ Google script ----------------------------- */
  const loadGoogleScript = useCallback(() => {
    if (document.getElementById("gsi-client")) return;

    const script = document.createElement("script");
    script.id = "gsi-client";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      // @ts-ignore – GSI global
      window.google.accounts.id.initialize({
        client_id: GA_CLIENT_ID,
        callback: handleCredentialResponse,
      });
      // @ts-ignore
      window.google.accounts.id.renderButton(
        document.getElementById("google-signin-button"),
        { theme: "outline", size: "large" },
      );
    };
    document.body.appendChild(script);
  }, [handleCredentialResponse]);

  /* --------------------- Verify stored token -------------------------- */
  const verifyStoredToken = useCallback(async () => {
    const token = localStorage.getItem(ID_TOKEN_KEY);
    if (!token) return;

    setIsLoading(true);
    try {
      const { data } = await axios.get(`${BASE_API_URL}/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserEmail(data.email);
      setIsAuthenticated(true);
    } catch {
      localStorage.removeItem(ID_TOKEN_KEY);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* --------------------------- Mount ---------------------------------- */
  useEffect(() => {
    loadGoogleScript();
    verifyStoredToken();
  }, [loadGoogleScript, verifyStoredToken, handleCredentialResponse]);

  /* --------------------------- Logout --------------------------------- */
  const handleLogout = () => {
    localStorage.removeItem(ID_TOKEN_KEY);
    setIsAuthenticated(false);
    setUserEmail("");
    window.location.reload();
  };

  /* ----------------------- Generate image ----------------------------- */
  const handleGenerateImage = async () => {
    if (!prompt.trim()) {
      f7.dialog.alert("Please enter a prompt for image generation");
      return;
    }

    if (!token) {
        f7.dialog.alert("Please enter your token to generate images");
        return;
    }

    setIsGenerating(true);
    setGeneratedImageUrl(null);
    console.log("Generating image with parameters:")

    try {
      const encodedPrompt = encodeURIComponent(prompt.trim());
      const imageUrl = `${IMAGE_API_URL}/${encodedPrompt}?w=${width}&h=${height}&seed=${seed}&model=${model}&token=${token}`;

      setGeneratedImageUrl(imageUrl);
      const img = new Image();
        img.src = imageUrl;
        img.onload = () => {
            setIsGenerating(false);
        }
        img.onerror = () => {
            setIsGenerating(false);
            f7.dialog.alert("Failed to load generated image");
        };
    } catch (error) {
      f7.dialog.alert("Failed to generate image. Please try again.");
      console.error("Image generation error:", error);
    } finally {
    }
  };

  /* ----------------------- helpers ----------------------------------- */
  const buildImageURL = (
    prm: string,
    w: number,
    h: number,
    sd: number,
    mdl: string,
    tok: string,
  ) =>
    `${IMAGE_API_URL}/${encodeURIComponent(prm)}?w=${w}&h=${h}&seed=${sd}&model=${mdl}&token=${tok}`;


  /* ---------------------- Generate DATASET --------------------------- */
  const handleGenerateDataset = async () => {
    if (!prompt.trim()) {
      f7.dialog.alert("Please enter a prompt for image generation");
      return;
    }
    if (!token) {
      f7.dialog.alert("Please enter your token to generate images");
      return;
    }
    setIsLoading(true);
    setIsGeneratingDataset(true);
    setDatasetRows([]); // fresh run

    for (let i = 0; i < batchSize; i += 1) {
      const currentSeed = i; // 0 … batchSize-1, as requested
      const id = i + 1;

      // create placeholder row
      setDatasetRows((prev) => [
        ...prev,
        {
          id,
          promptSnippet: prompt.slice(0, 100),
          width,
          height,
          seed: currentSeed,
          model,
        },
      ]);

      // wrap in async IIFE so for-loop awaits completion sequentially
      // (keeps order predictable, avoids hammering the API)
      // eslint-disable-next-line no-await-in-loop
      await (async () => {
        const started = Date.now();
        const img = new Image();
        const url = buildImageURL(prompt, width, height, currentSeed, model, token);
        img.src = url;

        // we cannot detect progress percentage, but we update elapsed time each sec
        const timer = window.setInterval(() => {
          setDatasetRows((prev) =>
            prev.map((row) =>
              row.id === id
                ? {
                    ...row,
                    time: Math.floor((Date.now() - started) / 1000),
                  }
                : row,
            ),
          );
        }, 1_000);

        await new Promise((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () =>
            reject(new Error("Image failed to load (see console)."));
        }).catch((err) => {
          console.error(err);
          f7.dialog.alert(`Image #${id} failed. Skipping.`);
        });

        // stop timer and finalise the row
        window.clearInterval(timer);

        const finished = Date.now();
        const elapsed = ((finished - started) / 1000).toFixed(1); // float string
        const finalSrc = img.currentSrc || img.src; // after redirect
        //const preview = proxyPreview(finalSrc);

        setDatasetRows((prev) =>
          prev.map((row) =>
            row.id === id
              ? { ...row, time: elapsed, previewUrl: finalSrc }
              : row,
          ),
        );
      })();
    }

    setIsGeneratingDataset(false);
    setIsLoading(false);
  };

  /* -------------------------- CSV download --------------------------- */
  const handleDownloadCSV = async () => {
      console.log("Downloading dataset CSV…");
      if (!datasetRows.length) return;


      /* ------------------------------------------------------------------ */
      /* 2. Build CSV rows, resolving the final image URL via /s/{prompt}   */
      /* ------------------------------------------------------------------ */
      const header =
        "number,prompt,width,height,seed,model,time_sec,image_url";

      const rows = await Promise.all(
        datasetRows
          .filter((r) => r.previewUrl) // only completed images
          .map(async (r) => {
            // Common row prefix
            const promptText = r.prompt || r.promptSnippet || "";
            const rowStart =
              `${r.id},"${promptText.replace(/"/g, '""')}",` +
              `${r.width},${r.height},${r.seed},${r.model},${r.time ?? ""},`;

            // Query string for the /s endpoint
            const qs =
              `?w=${r.width}&h=${r.height}` +
              `&seed=${r.seed}&model=${r.model}` +
              `&token=${encodeURIComponent(token)}`;

            try {
              const res = await fetch(
                `${MAIN_API_URL}/s/${encodeURIComponent(promptText)}${qs}`,
                { method: "GET", mode: "cors" },
              );

              if (res.ok) {
                const data = await res.json(); // { url: "…" }
                return rowStart + data.url;
              }
            } catch (err) {
              console.warn("Failed to resolve final URL:", err);
            }

            // Fallback to the original preview URL
            return rowStart + r.previewUrl;
          }),
      );

      /* ------------------------------------------------------------------ */
      /* 3. Create & download the CSV file                                  */
      /* ------------------------------------------------------------------ */
      const csvString = [header, ...rows].join("\n");
      const csvBlob = new Blob([csvString], { type: "text/csv;charset=utf-8" });


      const url = URL.createObjectURL(csvBlob);
      const a = document.createElement("a");
      a.href = url;
      a.className = "external";
      a.download = `dataset_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    };
      /* ---------------------- Analyse DATASET ----------------------------- */
    const handleAnalyseDataset = async () => {
      if (!aprompt.trim()) {
        f7.dialog.alert("Please enter a prompt for analysis");
        return;
      }
      if (!selectedModels.length) {
        f7.dialog.alert("Please select at least one model");
        return;
      }
      if (!token) {
        f7.dialog.alert("Please enter your token");
        return;
      }

      setIsAnalysingingDataset(true);
      setAnalysisRows([]);

      /** build a proxy thumbnail once so we don’t repeat string literal all over */
      const mkThumb = (url: string) =>
        `${url}&maxage=31d&width=100&height=50`;

      /** sequentially walk each dataset row → short URL → every selected model     */
      let rowCounter = 0;
      for (const r of datasetRows) {
        /* skip unfinished images */
        if (!r.previewUrl) continue;

        /* STEP 1: resolve the *canonical* image URL via /s/{prompt} -------------- */
        const qs =
          `?w=${r.width}&h=${r.height}` +
          `&seed=${r.seed}&model=${r.model}&token=${encodeURIComponent(token)}`;
        let finalUrl = r.previewUrl; // fallback
        try {
          const res = await fetch(
            `${MAIN_API_URL}/s/${encodeURIComponent(r.promptSnippet)}${qs}`,
            { method: "GET", mode: "cors" },
          );
          if (res.ok) {
            const { url } = await res.json();
            if (url) finalUrl = url;
          }
        } catch (err) {
          /* ignore – we still have previewUrl as a fallback */
          // eslint-disable-next-line no-console
          console.warn("Failed to resolve /s/ URL, using preview:", err);
        }

        const thumbUrl = mkThumb(finalUrl);

        /* STEP 2: fire one chat request per selected model ---------------------- */
        for (const mdl of selectedModels) {
          rowCounter += 1;
          const currentRowId = rowCounter;

          /* 2a: insert the placeholder row with “pending” status */
          setAnalysisRows(prev => [
            ...prev,
            {
              id: currentRowId,
              imageId: r.id,
              imageUrl: thumbUrl,
              model: mdl,
              status: "pending",
              result: "",
            },
          ]);

          /* 2b: send chat completion (no await → allow true concurrency) */
          (async () => {

               const started = Date.now();
               /* update elapsed time every second while the call is pending */
               const timer = window.setInterval(() => {
                 setAnalysisRows(prev =>
                   prev.map(row =>
                     row.id === currentRowId
                       ? { ...row, time: Math.floor((Date.now() - started) / 1000) }
                       : row,
                   ),
                 );
               }, 1_000);
            try {
              const resp = await fetch(`${MAIN_API_URL}/v1/chat/completions`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  model: mdl,
                  messages: [
                    {
                      role: "user",
                      content: [{ type: "text", text: aprompt.trim() }],
                    },
                    {
                      role: "user",
                      content: [
                        {
                          type: "image_url",
                          image_url: { url: finalUrl },
                        },
                      ],
                    },
                  ],
                }),
              });

              if (!resp.ok)
                throw new Error(`HTTP ${resp.status} ${resp.statusText}`);

              const data = await resp.json();
              const answer = (() => {
                  const raw = data?.choices?.[0]?.message?.content ?? "";
                  if (typeof raw !== "string") return "(empty)";
                  const trimmed = raw.trim();
                  if (!trimmed) return "(empty)";

                  // Some models return the whole completion JSON as a string…
                  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
                    try {
                      const inner = JSON.parse(trimmed);
                      return (
                        inner?.choices?.[0]?.message?.content?.trim() ||
                        trimmed /* fallback to original text */
                      );
                    } catch {
                      /* not valid JSON – just return the text */
                    }
                  }
                  return trimmed;
                })();

              /* update row with final answer */
              window.clearInterval(timer);
              const elapsed = ((Date.now() - started) / 1000).toFixed(1);
              setAnalysisRows(prev =>
                prev.map(row =>
                  row.id === currentRowId
                    ? { ...row, status: "done", result: answer, time: elapsed }
                    : row,
                ),
              );
            } catch (err) {
              window.clearInterval(timer);
              setAnalysisRows(prev =>
                prev.map(row =>
                  row.id === currentRowId
                    ? {
                        ...row,
                       status: "error",
                        time: ((Date.now() - started) / 1000).toFixed(1),
                        result:
                          err instanceof Error ? err.message : String(err),
                      }
                    : row,
                ),
              );
            }
          })();
        }
      }

      setIsAnalysingingDataset(false);
    };
    /* ------------------- CSV download – ANALYSIS ------------------------ */
    const handleDownloadAnalysisCSV = () => {
      if (!analysisRows.length) return;

      const header = "number,image_id,model,time_sec,status,response,image_url";
      const rows = analysisRows.map((r) => {
        const resp = (r.result || "").replace(/"/g, '""'); // escape quotes
        return (
          `${r.id},${r.imageId},${r.model},${r.time ?? ""},${r.status},"${resp}",` +
          `${r.imageUrl}`
        );
      });

      const csvString = [header, ...rows].join("\n");
      const csvBlob = new Blob([csvString], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(csvBlob);
      const a = document.createElement("a");
      a.href = url;
      a.className = "external";
      a.download = `analysis_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    };



  /* ----------------------- Open image in new tab ------------------- */
  const handleImageClick = () => {
    if (generatedImageUrl) {
      window.open(generatedImageUrl, "_blank");
    }
  };

  /* --------------------------- Render -------------------------------- */
  return (
    <App name="LLM7" theme="ios">
      {!isAuthenticated ? (
        <LoginScreen opened>
          <View>
            <Page loginScreen>
              <LoginScreenTitle>Sign in with Google</LoginScreenTitle>
              <Block>
                <div
                  id="google-signin-button"
                  align="center"
                  style={{
                    width: "100%",
                    maxWidth: 250,
                    margin: "1rem auto 0",
                    height: 50,
                    pointerEvents: isTermsAccepted ? "auto" : "none",
                    opacity: isTermsAccepted ? 1 : 0.5,
                    justifyContent: "center",
                  }}
                />

                <div style={{ display: "flex", justifyContent: "center" }}>
                  <List
                    outlineIos
                    dividersIos
                    style={{ width: "100%", maxWidth: 320, paddingLeft: 42 }}
                  >
                    <ListItem
                      className="important-weight"
                      checkbox
                      name="terms-checkbox"
                      title={
                        <>
                          I agree to the{" "}
                          <Link
                            external
                            href="https://github.com/chigwell/llm7.io/blob/main/TERMS.md"
                            target="_blank"
                          >
                            Terms of Use
                          </Link>
                        </>
                      }
                      checked={isTermsAccepted}
                      onChange={(e) => setIsTermsAccepted(e.target.checked)}
                    />
                  </List>
                </div>
              </Block>

              {isLoading && (
                <Block style={{ textAlign: "center" }}>
                  <Preloader />
                </Block>
              )}
            </Page>
          </View>
        </LoginScreen>
      ) : (
        <View main>
          <Page>
            {/* Navbar ---------------------------------------------------- */}
            <Navbar>
              <NavTitle>Image Generation Playground</NavTitle>
              <Button
                slot="right"
                small
                style={{ marginRight: 8 }}
                onClick={handleLogout}
              >
                Logout
              </Button>
            </Navbar>

            {/* Welcome --------------------------------------------------- */}
            <Block>
              <p>Welcome, {userEmail}!</p>
            </Block>

            {/* Image Generation Playground ------------------------------- */}
            <Block>
              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                }}
              >
                {/* ------------------ Left column: form ---------------- */}
                <div style={{ flex: "1 1 320px", maxWidth: 480 }}>
                  {/* Prompt Input */}
                  <List strongIos dividersIos insetIos
                    style={{ marginLeft: 0, marginTop: 0 }}
                  >
                    <ListInput outline
                      label="Prompt"
                      type="textarea"
                      placeholder="Enter your image description..."
                      value={prompt}
                      maxLength={PROMPT_MAX}
                      onInput={(e) => setPrompt(e.target.value.slice(0, PROMPT_MAX))}
                      disabled={isGenerating}
                      resizable
                      style={{ minHeight: "40px" }}
                    />

                    {/* Token Input */}
                    <ListInput outline
                      label="Token"
                      type="password"
                      placeholder="token"
                      value={token}
                      onInput={(e) =>
                        setToken((e.target.value) || "")
                      }
                      disabled={isGenerating}
                    />

                    {/* Width Input */}
                    <ListInput outline
                      label="Width (px)"
                      type="number"
                      placeholder="500"
                      min={W_MIN}
                      max={W_MAX}
                      value={width}
                      onInput={(e) => {
                        const v = parseInt(e.target.value, 10);
                        setWidth(Number.isFinite(v) ? Math.min(Math.max(v, W_MIN), W_MAX) : 500);
                      }}
                      disabled={isGenerating}
                    />

                    {/* Height Input */}
                    <ListInput outline
                      label="Height (px)"
                      type="number"
                      placeholder="500"
                      min={H_MIN}
                      max={H_MAX}
                      value={height}
                      onInput={(e) => {
                        const v = parseInt(e.target.value, 10);
                        setHeight(Number.isFinite(v) ? Math.min(Math.max(v, H_MIN), H_MAX) : 1000);
                      }}
                      disabled={isGenerating}
                    />

                    {/* Seed Input */}
                    <ListInput outline
                      label="Seed"
                      type="number"
                      placeholder="42"
                      min={SEED_MIN}
                      max={SEED_MAX}
                      value={seed}
                      onInput={(e) => {
                        const v = parseInt(e.target.value, 10);
                        setSeed(Number.isFinite(v) ? Math.min(Math.max(v, SEED_MIN), SEED_MAX) : 0);
                      }}
                      disabled={isGenerating}
                    />

                    {/* Model Selection */}
                    <ListInput outline
                      label="Model"
                      type="select"
                      value={model}
                      onInput={(e) => setModel(e.target.value)}
                      disabled={isGenerating}
                    >
                      <option value="1">FLUX 1.1 Pro</option>
                      <option value="2">Fast</option>
                    </ListInput>
                  </List>

                  {/* Generate Button */}
                  <Block>
                    <Button
                      fill
                      large
                      onClick={handleGenerateImage}
                      disabled={isGenerating || !prompt.trim()}
                    >
                      {isGenerating ? (
                        <>
                          <Preloader size={16} style={{ marginRight: 8 }} />
                          Generating...
                        </>
                      ) : (
                        "Generate Image"
                      )}
                    </Button>
                  </Block>
                </div>

                {/* -------------- Right column: image ------------------ */}
                <div style={{ flex: "1 1 360px", minWidth: 0 }}>
                  {!isGenerating && !generatedImageUrl && (
                      <div align="center">
                        <Skeleton
                          width={width}
                          height={height}
                          enableAnimation
                        />
                      </div>
                    )}
                  {(isGenerating || generatedImageUrl) && (
                    <Card
                        style={{
                            marginTop: 0,
                        }}
                    >
                      <CardHeader align="center">
                        {isGenerating ? "Generating Image..."
                         :
                       "Generated Image"
                        }
                      </CardHeader>
                      <CardContent>
                        {isGenerating ? (
                              <div align="center">
                                <Skeleton
                                  baseColor="#007aff"
                                  highlightColor="#60a5fa"
                                  width={width}
                                  height={height}
                                  enableAnimation
                                />
                              </div>
                        ) : generatedImageUrl ? (
                          <div align ="center">
                              <img
                                src={generatedImageUrl}
                                alt="Generated"
                                style={{
                                  width: width,
                                  height: height,
                                  borderRadius: "8px",
                                  cursor: "pointer",
                                }}
                                onClick={handleImageClick}
                                onLoad={() => setIsGenerating(false)}
                                onError={() => {
                                  setIsGenerating(false);
                                  f7.dialog.alert("Failed to load generated image");
                                }}
                              />
                            </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </Block>

            {/* Insert this block wherever you want the dataset table to appear.
          Below shows it inside the existing “Generate dataset” Card. */}
              <Block>
                <Card>
                  <CardHeader>
                    Generate dataset
                    <Button
                      style={{ marginLeft: 8 }}
                      small
                      outline
                      onClick={handleDownloadCSV}
                      disabled={
                        !datasetRows.length ||
                        datasetRows.some((r) => !r.previewUrl)
                      }
                    >
                      Download CSV
                    </Button>
                  </CardHeader>

                  <CardContent>
                    {/* controls (batch size, approx. time, start button) -------- */}
                    <div className="grid grid-cols-3 grid-gap">
                      <div>
                        <List strongIos dividersIos insetIos style={{ margin: 0 }}>
                          <ListInput
                            outline
                            label="Number of images"
                            type="number"
                            placeholder="100"
                            min={1}
                            max={1000}
                            value={batchSize}
                            onInput={(e) => {
                              const v = parseInt(e.target.value, 10);
                              setBatchSize(
                                Number.isFinite(v)
                                  ? Math.min(Math.max(v, 1), 1000)
                                  : 100,
                              );
                              calculateAproximatlyTime(v);
                            }}
                            disabled={isGeneratingDataset}
                          />
                        </List>
                      </div>
                      <div style={{ marginTop: 16 }}>{aproximatlyTime}</div>
                      <div style={{ marginTop: 16 }}>
                        <Button
                          fill
                          large
                          onClick={handleGenerateDataset}
                          disabled={isGeneratingDataset || !prompt.trim()}
                        >
                          {isGeneratingDataset ? (
                            <>
                              <Preloader size={16} style={{ marginRight: 8 }} />
                              Generating...
                            </>
                          ) : (
                            "Generate Dataset"
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* -------------- dynamic result table --------------------- */}
                    {!!datasetRows.length && (
                      <table
                        style={{
                          width: "100%",
                          marginTop: 24,
                          borderCollapse: "collapse",
                        }}
                      >
                        <thead>
                          <tr>
                            {[
                              "#",
                              "Prompt",
                              "W",
                              "H",
                              "Seed",
                              "Model",
                              "Time (s)",
                              "Preview",
                            ].map((h) => (
                              <th
                                key={h}
                                style={{
                                  borderBottom: "1px solid #ddd",
                                  padding: "4px 6px",
                                  textAlign: "left",
                                }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {datasetRows.map((row) => (
                            <tr key={row.id}>
                              <td style={{ padding: "4px 6px" }}>{row.id}</td>
                              <td style={{ padding: "4px 6px" }}>
                                {row.promptSnippet}
                              </td>
                              <td style={{ padding: "4px 6px" }}>{row.width}</td>
                              <td style={{ padding: "4px 6px" }}>{row.height}</td>
                              <td style={{ padding: "4px 6px" }}>{row.seed}</td>
                              <td style={{ padding: "4px 6px" }}>{row.model}</td>
                              <td style={{ padding: "4px 6px" }}>
                                {row.time ?? (
                                  <Preloader size={12} style={{ display: "inline" }} />
                                )}
                              </td>
                              <td style={{ padding: "4px 6px" }}>
                                {row.previewUrl ? (
                                  <a target="_blank" rel="noopener noreferrer" className="external"
                                    href={row.previewUrl}>
                                      <img
                                        src={row.previewUrl}
                                        alt={`preview ${row.id}`}
                                        width={100}
                                        height={50}
                                        style={{ borderRadius: 4 }}
                                      />
                                  </a>
                                ) : (
                                  <Skeleton width={100} height={50} baseColor="#007aff"
                                  highlightColor="#60a5fa" enableAnimation />
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
              </Block>

              {datasetRows.length > 0 && (
               <Block>
                <Card>
                  <CardHeader>
                      Analysis&nbsp;
                      <Button
                        style={{ marginLeft: 8 }}
                        small
                        outline
                        onClick={handleDownloadAnalysisCSV}
                        disabled={
                          !analysisRows.length || analysisRows.some((r) => r.status === "pending")
                        }
                      >
                        Download CSV
                      </Button>
                    </CardHeader>

                  <CardContent>
                      <List strongIos dividersIos insetIos style={{ marginLeft: 0, marginTop: 0 }}>
                        <ListItem
                          title="Models to analyse"
                          smartSelect
                          smartSelectParams={{ openIn: "popover" }}
                        >
                          <select
                            name="analysis-models"
                            multiple
                            value={selectedModels}
                            onChange={(e) =>
                              setSelectedModels(
                                Array.from(e.target.selectedOptions).map((o) => o.value),
                              )
                            }
                          >
                            {imageModels.map((id) => (
                              <option key={id} value={id}>
                                {id}
                              </option>
                            ))}
                          </select>
                        </ListItem>
                        <ListInput outline
                          label="Prompt"
                          type="textarea"
                          placeholder="Enter your task for LLM to analyse the dataset..."
                          value={aprompt}
                            maxLength={PROMPT_MAX}
                            onInput={(e) => setAprompt(e.target.value.slice(0, PROMPT_MAX))}
                            style={{ minHeight: "40px" }}
                        />


                      </List>
                      <div className="grid grid-cols-3 grid-gap">
                      <div>
                      </div>
                      <div>
                      </div>
                      <div>
                      <Button
                          fill
                          large
                          onClick={handleAnalyseDataset}
                          disabled={isGeneratingDataset || !aprompt.trim() || isAnalysingingDataset || !selectedModels.length}
                        >
                          {isAnalysingingDataset ? (
                            <>
                              <Preloader size={16} style={{ marginRight: 8 }} />
                              Analysing...
                            </>
                          ) : (
                            "Analyse Dataset"
                          )}
                        </Button>
                      </div>
                        </div>
                        {/* -------- analysis results table ----------------------------------- */}
                        {!!analysisRows.length && (
                          <table
                            style={{ width: "100%", marginTop: 24, borderCollapse: "collapse" }}
                          >
                            <thead>
                              <tr>
                                {["#", "Image #", "Preview", "Model", "Time (s)", "Status / Response"].map(h => (
                                  <th
                                    key={h}
                                    style={{
                                      borderBottom: "1px solid #ddd",
                                      padding: "4px 6px",
                                      textAlign: "left",
                                    }}
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {analysisRows.map(row => (
                                <tr key={row.id}>
                                  <td style={{ padding: "4px 6px" }}>{row.id}</td>
                                  <td style={{ padding: "4px 6px" }}>{row.imageId}</td>
                                  <td style={{ padding: "4px 6px" }}>
                                    <a
                                      href={row.imageUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="external"
                                    >
                                      <img
                                        src={row.imageUrl}
                                        alt={`img ${row.imageId}`}
                                        width={100}
                                        height={50}
                                        style={{ borderRadius: 4 }}
                                      />
                                    </a>
                                  </td>
                                  <td style={{ padding: "4px 6px" }}>{row.model}</td>
                                  <td style={{ padding: "4px 6px" }}>{row.time ?? <Preloader size={12} />}</td>
                                  <td style={{ padding: "4px 6px", whiteSpace: "pre-wrap" }}>
                                    {row.status === "pending" ? (
                                      <Preloader size={12} style={{ display: "inline" }} />
                                    ) : (
                                      row.result
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}

                    </CardContent>
                </Card>
               </Block>
              )}
          </Page>
        </View>
      )}
    </App>
  );
}

export default MyApp;