(() => {
  const FILE_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "video/mp4"
  ];

  const MAX_FILE_SIZE_MB = 50;
  const UPLOAD_SERVICE = "http://localhost:3000/upload";

  function log(message) {
    console.log("[YT Media Uploader]", message);
  }

  function getFileExtension(fileName) {
    return (fileName || "").split(".").pop()?.toLowerCase() || "";
  }

  function isAllowedFile(file) {
    const extension = getFileExtension(file.name);
    const typeOk = FILE_TYPES.includes(file.type) || ["jpg", "jpeg", "gif", "mp4"].includes(extension);
    const sizeOk = file.size <= MAX_FILE_SIZE_MB * 1024 * 1024;
    return typeOk && sizeOk;
  }

  function createButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Upload media";
    button.title = "Upload JPG, GIF, or MP4 and insert the public URL into the comment!";
    button.style.cssText = `
      border: none;
      border-radius: 999px;
      background: #0f172a;
      color: #fff;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      padding: 8px 12px;
      margin-left: 8px;
      transition: transform 0.15s ease;
      white-space: nowrap;
    `;
    button.addEventListener("mouseenter", () => {
      button.style.transform = "translateY(-1px)";
    });
    button.addEventListener("mouseleave", () => {
      button.style.transform = "translateY(0)";
    });
    return button;
  }

  function pasteIntoFocusedComment(url) {
    const target = document.activeElement;
    const fallbackTargets = [
      document.querySelector('div[contenteditable="true"]'),
      document.querySelector('textarea'),
      document.querySelector('div[role="textbox"]'),
      target
    ].filter(Boolean);

    const candidate = fallbackTargets.find((el) => {
      if (!el) return false;
      const text = el.textContent || el.value || "";
      const isCommentBox = el.closest("ytd-comment-simplebox-renderer") ||
        el.closest("ytd-comment-box") ||
        el.closest("div#comment-box") ||
        (el.getAttribute && (el.getAttribute("aria-label") || "").toLowerCase().includes("comment"));
      return isCommentBox && (el.isContentEditable || el.tagName === "TEXTAREA");
    }) || fallbackTargets[0];

    if (!candidate) {
      alert("댓글 입력창을 찾지 못했습니다. 댓글을 열어 둔 뒤 다시 시도해주세요.");
      return false;
    }

    if (candidate.isContentEditable) {
      candidate.focus();
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const node = document.createTextNode(`${url} `);
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        candidate.textContent += `${url} `;
      }
    } else if (candidate.tagName === "TEXTAREA") {
      const start = candidate.selectionStart;
      const end = candidate.selectionEnd;
      const existing = candidate.value || "";
      candidate.value = existing.slice(0, start) + `${url} ` + existing.slice(end);
      candidate.selectionStart = candidate.selectionEnd = start + `${url} `.length;
      candidate.dispatchEvent(new Event("input", { bubbles: true }));
    }

    return true;
  }

  async function uploadFile(file) {
    if (!isAllowedFile(file)) {
      throw new Error("허용된 파일 형식은 JPG/JPEG, GIF, MP4만 가능합니다. 크기는 50MB 이하여야 합니다.");
    }

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(UPLOAD_SERVICE, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`업로드 서버 응답이 실패했습니다. (${response.status}) ${errorBody || "unknown error"}`);
    }

    const result = await response.json();
    const url = result?.data?.file?.url?.full || result?.data?.file?.url?.short || result?.data?.url || result?.data?.file?.url;

    if (!url) {
      throw new Error("업로드는 성공했지만 다운로드 URL을 찾지 못했습니다.");
    }

    return url;
  }

  function attachUploadButtonToCommentBox(commentBox) {
    if (!commentBox || commentBox.dataset.mediaUploaderAttached === "true") {
      return;
    }

    const parent = commentBox.parentElement;
    if (!parent) return;

    const wrapper = document.createElement("div");
    wrapper.style.cssText = "display:flex; align-items:center; justify-content:space-between; gap:8px; width:100%;";

    const button = createButton();
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".jpg,.jpeg,.gif,.mp4,image/jpeg,image/gif,video/mp4";
    fileInput.style.display = "none";

    button.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", async () => {
      const selected = fileInput.files?.[0];
      if (!selected) return;

      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = "Uploading...";
      button.style.opacity = "0.8";

      try {
        const url = await uploadFile(selected);
        log(`Uploaded: ${url}`);
        const inserted = pasteIntoFocusedComment(url);

        if (inserted) {
          button.textContent = "Uploaded!";
        } else {
          button.textContent = originalText;
        }
      } catch (error) {
        log(error.message || "Upload failed");
        alert(error.message || "업로드에 실패했습니다.");
        button.textContent = originalText;
      } finally {
        fileInput.value = "";
        button.disabled = false;
        button.style.opacity = "1";
        setTimeout(() => {
          button.textContent = originalText;
        }, 1500);
      }
    });

    wrapper.appendChild(button);
    wrapper.appendChild(fileInput);
    parent.insertBefore(wrapper, commentBox.nextSibling);
    commentBox.dataset.mediaUploaderAttached = "true";
  }

  function scanForCommentBoxes() {
    const commentBoxes = document.querySelectorAll('div[contenteditable="true"], textarea');
    commentBoxes.forEach((box) => {
      const isLikelyComment =
        box.closest("ytd-comment-simplebox-renderer") ||
        box.closest("ytd-comment-box") ||
        box.closest("div#comment-box") ||
        (box.getAttribute && (box.getAttribute("aria-label") || "").toLowerCase().includes("comment"));

      if (isLikelyComment) {
        attachUploadButtonToCommentBox(box);
      }
    });
  }

  const observer = new MutationObserver(() => {
    scanForCommentBoxes();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["contenteditable", "aria-label", "class"]
  });

  scanForCommentBoxes();
})();
