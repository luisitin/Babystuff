// Synthetic sign-up form served in place of an official page. Nothing here is a real site's markup.
const months = Array.from({ length: 12 }, (_, i) => '<option value="' + String(i + 1).padStart(2, '0') + '">' + ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][i] + '</option>').join('');
const days = Array.from({ length: 31 }, (_, i) => '<option value="' + String(i + 1).padStart(2, '0') + '">' + (i + 1) + '</option>').join('');
const years = [2026, 2027, 2028].map((y) => '<option value="' + y + '">' + y + '</option>').join('');

export const FORM_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fixture form</title></head><body>
<div role="search"><label for="q">Search the site</label><input id="q" name="q" type="search"></div>
<form id="f" action="/submit" method="post">
<p><label for="fn">First name</label><input id="fn" name="fname"></p>
<p><label for="ln">Last name</label><input id="ln" name="lname"></p>
<p><label for="full">Full name</label><input id="full" name="fullname"></p>
<p><label for="em">Email address</label><input id="em" type="email" name="email"></p>
<p><label for="em2">Confirm email address</label><input id="em2" type="email" name="email_confirm"></p>
<p><label for="ph">Phone number</label><input id="ph" type="tel" name="phone"></p>
<p><label for="a1">Street address</label><input id="a1" name="address1" autocomplete="address-line1"></p>
<p><label for="a2">Apartment, suite (optional)</label><input id="a2" name="address2" autocomplete="address-line2"></p>
<p><label for="city">City</label><input id="city" name="city"></p>
<p><label for="sc">State</label><select id="sc" name="state_code"><option value="">Select</option><option value="CA">CA</option><option value="TX">TX</option></select></p>
<p><label for="sn">Your state</label><select id="sn" name="state_name"><option value="">Choose a state</option><option value="California">California</option><option value="Texas">Texas</option></select></p>
<p><label for="zip">ZIP code</label><input id="zip" name="zip"></p>
<p><label for="due">Due date</label><input id="due" type="date" name="due"></p>
<fieldset><legend>Estimated due date</legend>
<label for="dm">Due month</label><select id="dm" name="due_month"><option value="">Month</option>${months}</select>
<label for="dd">Due day</label><select id="dd" name="due_day"><option value="">Day</option>${days}</select>
<label for="dy">Due year</label><select id="dy" name="due_year"><option value="">Year</option>${years}</select></fieldset>
<p><label for="pw">Create a password</label><input id="pw" type="password" name="password"></p>
<input id="hid" type="hidden" name="token" value="">
<p><label for="dis">Email on file</label><input id="dis" name="email_on_file" disabled></p>
<p><label for="pre">Nickname</label><input id="pre" name="nick" value="keep-me"></p>
<p><label for="pre2">City (already typed)</label><input id="pre2" name="city2" value="Typed Town"></p>
<p><label><input id="mk" type="checkbox" name="marketing"> Send me offers by email</label></p>
<p><label for="cc">Card number</label><input id="cc" name="cardnumber" autocomplete="cc-number"></p>
<button id="go" type="submit">Join now</button>
</form>
<script>
window.__clicks = 0; window.__submits = 0;
document.getElementById('go').addEventListener('click', function () { window.__clicks++; });
document.getElementById('f').addEventListener('submit', function (e) { window.__submits++; e.preventDefault(); });
</script></body></html>`;
