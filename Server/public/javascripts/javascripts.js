const voterDetailsForm = document.getElementById("voter-details-form");
if (voterDetailsForm) {
  const continueButton = voterDetailsForm.querySelector('button[type="submit"]');
  const updateContinueButton = () => {
    continueButton.disabled = !voterDetailsForm.checkValidity();
  };

  voterDetailsForm.addEventListener("input", updateContinueButton);
  voterDetailsForm.addEventListener("change", updateContinueButton);
  updateContinueButton();
}
