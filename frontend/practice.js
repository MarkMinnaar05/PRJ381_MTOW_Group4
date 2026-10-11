(function () {
  let sessionId, question;
  const start = document.getElementById('startPractice');
  const form = document.getElementById('practiceAnswer');
  const input = document.getElementById('practiceValue');
  const submit = document.getElementById('submitPractice');
  const finish = document.getElementById('endPractice');
  const message = document.getElementById('practiceFeedback');
  const score = document.getElementById('practiceScore');
  function enabled(active) { input.disabled = !active; submit.disabled = !active; finish.disabled = !active; start.disabled = active; }
  async function nextQuestion() {
    question = await MTOWApi.request('/question/next/' + sessionId);
    document.getElementById('practiceQuestion').textContent = question.text + ' = ?';
    input.value = ''; input.focus();
  }
  start.onclick = async () => {
    start.disabled = true;
    try {
      await MTOWApi.ensureGuest();
      const result = await MTOWApi.request('/session/start', { method: 'POST', body: JSON.stringify({ difficulty: 1 }) });
      sessionId = result.sessionId; enabled(true); score.textContent = 'Score: 0 · XP: 0'; message.textContent = '';
      await nextQuestion();
    } catch (error) { message.textContent = error.message; enabled(false); }
  };
  form.onsubmit = async event => {
    event.preventDefault(); submit.disabled = true;
    try {
      const result = await MTOWApi.request('/answer/submit', { method: 'POST', body: JSON.stringify({ sessionId, questionId: question.id, submittedAnswer: Number(input.value) }) });
      message.textContent = result.isCorrect ? 'Correct!' : 'The answer was ' + result.correctAnswer + '.';
      score.textContent = 'Score: ' + result.newScore + ' · XP: ' + result.newXP;
      if (result.isGameOver) { message.textContent += result.playerWon ? ' You won! Your progress is saved.' : ' Round finished. Your progress is saved.'; enabled(false); }
      else { await nextQuestion(); submit.disabled = false; }
    } catch (error) { message.textContent = error.message; submit.disabled = false; }
  };
  finish.onclick = async () => {
    finish.disabled = true;
    try { await MTOWApi.request('/session/end/' + sessionId, { method: 'DELETE' }); message.textContent = 'Round saved. Your XP is on your profile.'; enabled(false); }
    catch (error) { message.textContent = error.message; finish.disabled = false; }
  };
})();
