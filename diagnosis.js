const form = document.getElementById("diagnosisForm");
const notice = document.getElementById("diagnosisNotice");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  notice.style.display = "block";
  notice.textContent = "正在生成诊断报告，请稍等...";

  const data = collectForm(form);

  try {
    const resp = await fetch("/api/diagnosis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await resp.json();
    if (!resp.ok) throw new Error(result.error || "生成失败");

    notice.textContent = `报告已生成：${result.report_id}，正在打开报告页面...`;
    location.href = result.report_url;
  } catch (error) {
    notice.textContent = `生成失败：${error.message}`;
  }
});

function collectForm(formEl) {
  const data = {};
  const formData = new FormData(formEl);

  for (const [key, value] of formData.entries()) {
    if (data[key]) {
      if (!Array.isArray(data[key])) data[key] = [data[key]];
      data[key].push(value);
    } else {
      data[key] = value;
    }
  }

  for (const name of ["business_goal", "main_pain_points", "has_material", "conversion_tools"]) {
    data[name] = formData.getAll(name);
  }

  return data;
}
